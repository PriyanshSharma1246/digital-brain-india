"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, Conversation, ConversationResponse } from "@/app/types/chat";
import { createConversation, createMessage, createId, deriveTitle } from "@/lib/chatStorage";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatMessages from "@/components/chat/ChatMessages";
import ChatInput from "@/components/chat/ChatInput";
import AgentSelector from "@/components/chat/AgentSelector";
import { type AgentId } from "@/lib/agents";
import { parseImageAttachment } from "@/lib/multimodal";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
};

type ChatClientProps = {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
};

export default function ChatClient({ user }: ChatClientProps) {
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [assistantMessageId, setAssistantMessageId] = useState<string | null>(null);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageAttachment, setImageAttachment] = useState<string | null>(null);
  const [recognition, setRecognition] = useState<SpeechRecognitionLike | null>(null);
  const [activeAgent, setActiveAgent] = useState<AgentId>("general");
  const [conversationAgents, setConversationAgents] = useState<Record<string, AgentId>>(() => {
    if (typeof window === "undefined") return {};
    try {
      const stored = window.localStorage.getItem("india-digital-brain-agents");
      if (!stored) return {};
      const parsed = JSON.parse(stored) as Record<string, AgentId>;
      return parsed;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("india-digital-brain-agents", JSON.stringify(conversationAgents));
    }
  }, [conversationAgents]);

  useEffect(() => {
    if (activeId) {
      setActiveAgent(conversationAgents[activeId] ?? "general");
    }
  }, [activeId, conversationAgents]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionCtor =
      (window as Window & typeof globalThis & { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
      (window as Window & typeof globalThis & { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setVoiceStatus("Voice input is not supported in this browser.");
      return;
    }

    const recognitionInstance = new SpeechRecognitionCtor();
    recognitionInstance.lang = "en-IN";
    recognitionInstance.continuous = false;
    recognitionInstance.interimResults = true;

    recognitionInstance.onresult = (event: Event & { results?: ArrayLike<ArrayLike<{ transcript?: string }>> }) => {
      const results = event.results ?? [];
      const transcript = Array.from(results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ");
      setInput(transcript);
      setVoiceStatus("Voice capture complete.");
    };

    recognitionInstance.onerror = () => {
      setVoiceStatus("Voice capture failed. Please try again.");
      setIsRecording(false);
    };

    recognitionInstance.onend = () => {
      setIsRecording(false);
      setVoiceStatus(null);
    };

    setRecognition(recognitionInstance);
  }, []);

  useEffect(() => {
    async function loadHistory() {
      setIsRefreshing(true);
      try {
        const res = await fetch("/api/conversations", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && data.success && data.conversations?.length > 0) {
          const apiConversations: Array<{
            id: string;
            title: string;
            createdAt: string;
            updatedAt: string;
          }> = data.conversations;

          // Convert API summaries to the client Conversation shape.
          const mapped: Conversation[] = apiConversations.map((c) => ({
            id: c.id,
            title: c.title,
            messages: [],
            updatedAt: new Date(c.updatedAt).getTime(),
            isLocal: false,
          }));

          // Fetch the first page of messages for the most recent conversation.
          const first = mapped[0];
          if (first) {
            try {
              const msgRes = await fetch(
                `/api/conversations/${first.id}/messages?page=1&pageSize=50`,
                { cache: "no-store" }
              );
              const msgData = await msgRes.json();
              if (msgRes.ok && msgData.success) {
                first.messages = msgData.messages.map(
                  (m: {
                    id: string;
                    role: string;
                    content: string;
                    isError?: boolean;
                    createdAt: string;
                  }) => ({
                    id: m.id,
                    role: m.role === "assistant" ? "assistant" : "user",
                    message: m.content,
                    createdAt: new Date(m.createdAt).getTime(),
                    ...(m.isError ? { isError: true } : {}),
                  })
                );
              }
            } catch {
              // If the messages fetch fails, keep the empty conversation.
            }
          }

          setConversations(mapped);
          setActiveId(mapped[0]?.id ?? null);
        } else {
          // No persisted conversations yet — create one locally (it will be
          // persisted to the server on the first send via POST /api/conversations).
          const fresh = createConversation();
          setConversations([fresh]);
          setActiveId(fresh.id);
        }
      } catch {
        const fresh = createConversation();
        setConversations([fresh]);
        setActiveId(fresh.id);
      } finally {
        setHydrated(true);
        setIsRefreshing(false);
      }
    }

    loadHistory();
  }, []);

  const updateMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[], conversationId: string | null = activeId) => {
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== conversationId) return c;
          return {
            ...c,
            messages: updater(c.messages),
            updatedAt: Date.now(),
          };
        });
        return updated.sort((a, b) => b.updatedAt - a.updatedAt);
      });
    },
    [activeId]
  );

  const updateAssistantMessage = useCallback(
    (message: string, isError = false) => {
      if (!assistantMessageId) return;
      updateMessages((prev) =>
        prev.map((messageItem) =>
          messageItem.id === assistantMessageId
            ? { ...messageItem, message, isError }
            : messageItem
        )
      );
    },
    [assistantMessageId, updateMessages]
  );

  function resetMultimodalState() {
    setImagePreview(null);
    setImageAttachment(null);
    setVoiceStatus(null);
  }

  async function newConversation() {
    // Create a persisted conversation via the new Phase 4 API. If it fails,
    // fall back to a local conversation so the UI remains usable.
    let fresh = createConversation();
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New chat" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        fresh = {
          id: data.conversation.id,
          title: data.conversation.title,
          messages: [],
          updatedAt: new Date(data.conversation.updatedAt).getTime(),
          isLocal: false,
        };
      }
    } catch {
      // Fall back to the local conversation.
    }

    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInput("");
    setActiveAgent("general");
    resetMultimodalState();
    setSidebarOpen(false);
  }

  function handleAgentChange(nextAgent: AgentId) {
    setActiveAgent(nextAgent);
    if (activeId) {
      setConversationAgents((prev) => ({ ...prev, [activeId]: nextAgent }));
    }
  }

  function toggleVoiceRecording() {
    if (!recognition) {
      setVoiceStatus("Voice input is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognition.stop();
      setIsRecording(false);
      setVoiceStatus("Stopping voice recording...");
      return;
    }

    setIsRecording(true);
    setVoiceStatus("Listening...");
    recognition.start();
  }

  function removeImage() {
    setImagePreview(null);
    setImageAttachment(null);
    setUploadStatus(null);
  }

  async function deleteConversation(id: string) {
    try {
      await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch {
      // Allow local deletion even if server request fails.
    }

    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null);
        if (next.length === 0) {
          const fresh = createConversation();
          setActiveId(fresh.id);
          return [fresh];
        }
      }
      return next;
    });
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !imageAttachment) || isLoading || isUploading) return;

    let currentId = activeId;
    let currentConversation = activeConversation;

    if (!currentConversation) {
      const fresh = createConversation(deriveTitle(text));
      setConversations((prev) => [fresh, ...prev]);
      setActiveId(fresh.id);
      currentId = fresh.id;
      currentConversation = fresh;
    }

    const title =
      currentConversation.title === "New chat" && currentConversation.messages.length === 0
        ? deriveTitle(text)
        : currentConversation.title;

    if (
      currentConversation.title === "New chat" &&
      currentConversation.messages.length === 0
    ) {
      setConversations((prev) =>
        prev.map((c) => (c.id === currentId ? { ...c, title } : c))
      );
    }

    const userMsg = createMessage("user", text || (imageAttachment ? "[Image attached]" : ""));
    const assistantId = createId();
    const assistantMsg: ChatMessage = {
      ...createMessage("assistant", ""),
      id: assistantId,
    };

    updateMessages((prev) => [...prev, userMsg, assistantMsg], currentId);
    setAssistantMessageId(assistantId);
    setInput("");
    setIsLoading(true);
    resetMultimodalState();

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          conversationId: currentId,
          conversationTitle: title,
          agent: activeAgent,
          image: imageAttachment,
        }),
        signal: controller.signal,
      });

      const updateStreamingAssistantMessage = (message: string, isError = false) => {
        updateMessages(
          (prev) =>
            prev.map((messageItem) =>
              messageItem.id === assistantId
                ? { ...messageItem, message, isError }
                : messageItem
            ),
          currentId
        );
      };

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage =
          errorPayload?.error ||
          "Failed to stream AI response. Please try again.";
        updateStreamingAssistantMessage(errorMessage, true);
        return;
      }

      if (!response.body) {
        updateStreamingAssistantMessage(
          "AI stream unavailable. Please try again.",
          true
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let partial = "";
      let finished = false;

      const processLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) return;

        try {
          const payload = JSON.parse(trimmed) as {
            type?: string;
            text?: string;
            reply?: string;
            error?: string;
            retrievedDocumentTitles?: string[];
            sourcePaths?: string[];
            ragUsed?: boolean;
          };

          if (payload.type === "chunk" && typeof payload.text === "string") {
            partial += payload.text;
            updateStreamingAssistantMessage(partial);
          }

          if (payload.type === "done" && typeof payload.reply === "string") {
            finished = true;
            updateStreamingAssistantMessage(payload.reply);
          }

          if (payload.type === "error" && typeof payload.error === "string") {
            updateStreamingAssistantMessage(payload.error, true);
          }
        } catch {
          // Ignore invalid partial lines.
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }

      if (buffer.trim()) {
        processLine(buffer);
      }

      const trailing = decoder.decode();
      if (trailing) {
        const lines = (buffer + trailing).split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          processLine(line);
        }
      }

      if (!finished && partial) {
        updateStreamingAssistantMessage(partial);
      }
    } catch (error: unknown) {
      const isAbort =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";

      if (!isAbort) {
        updateMessages(
          (prev) =>
            prev.map((messageItem) =>
              messageItem.id === assistantId
                ? { ...messageItem, message: "❌ Failed to contact AI. Please check your connection and try again.", isError: true }
                : messageItem
            ),
          currentId
        );
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
      setAssistantMessageId(null);
    }
  }

  async function handleFileAttach(file: File) {
    if (isUploading || isLoading) return;

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          const parsed = parseImageAttachment(result);
          if (parsed) {
            setImagePreview(result);
            setImageAttachment(result);
            setUploadStatus(`Image ready: ${file.name}`);
          } else {
            setUploadStatus("Unsupported image payload.");
          }
        }
      };
      reader.readAsDataURL(file);
      return;
    }

    let currentId = activeId;
    let currentConversation = activeConversation;

    if (!currentConversation) {
      const fresh = createConversation();
      setConversations((prev) => [fresh, ...prev]);
      setActiveId(fresh.id);
      currentId = fresh.id;
      currentConversation = fresh;
    }

    const title =
      currentConversation.title === "New chat" && currentConversation.messages.length === 0
        ? deriveTitle(`Uploaded file: ${file.name}`)
        : currentConversation.title;

    if (
      currentConversation.title === "New chat" &&
      currentConversation.messages.length === 0
    ) {
      setConversations((prev) =>
        prev.map((c) => (c.id === currentId ? { ...c, title } : c))
      );
    }

    const userMsg = createMessage("user", `Uploaded file: ${file.name}`);
    const assistantId = createId();
    const assistantMsg: ChatMessage = {
      ...createMessage("assistant", ""),
      id: assistantId,
    };

    updateMessages((prev) => [...prev, userMsg, assistantMsg]);
    setAssistantMessageId(assistantId);
    setIsUploading(true);
    setUploadingFileName(file.name);
    setUploadStatus("Uploading file...");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("conversationId", currentId ?? "");

      const response = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        const errorMessage =
          result?.error || "Failed to upload file. Please try again.";
        setUploadStatus(errorMessage);
        updateAssistantMessage(errorMessage, true);
        return;
      }

      const successMessage =
        result.message || `Uploaded and processed ${file.name}.`;
      setUploadStatus(successMessage);
      updateAssistantMessage(successMessage);
    } catch (error) {
      const message = "Failed to upload file. Please check your connection.";
      setUploadStatus(message);
      updateAssistantMessage(message, true);
    } finally {
      setIsUploading(false);
      setUploadingFileName(null);
      setTimeout(() => setUploadStatus(null), 5000);
      setAssistantMessageId(null);
    }
  }

  function stopGenerating() {
    abortController?.abort();
    setAbortController(null);
    setIsLoading(false);
  }

  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onSelect={(id) => {
          setActiveId(id);
          setInput("");
          setSidebarOpen(false);
        }}
        onNew={newConversation}
        onDelete={deleteConversation}
        onRename={async (id, title) => {
          try {
            await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title }),
            });
          } catch {
            // Ignore failures and still update locally.
          }
          setConversations((prev) =>
            prev.map((c) => (c.id === id ? { ...c, title, updatedAt: Date.now() } : c))
          );
        }}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex flex-1 flex-col" aria-label="Chat interface">
        <header className="flex flex-col gap-4 border-b border-slate-800 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="shrink-0 sm:hidden"
              aria-label="Open sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-6 w-6 text-slate-300"
              >
                <path
                  fillRule="evenodd"
                  d="M3 6.75A.75.75 0 0 1 3.75 6h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 6.75ZM3 12a.75.75 0 0 1 .75-.75h16.5a.75.75 0 0 1 0 1.5H3.75A.75.75 0 0 1 3 12Zm0 5.25a.75.75 0 0 1 .75-.75H12a.75.75 0 0 1 0 1.5H3.75a.75.75 0 0 1-.75-.75Z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            <div>
              <h1 className="text-lg font-semibold text-slate-200">
                {activeConversation?.title ?? "AI Chat"}
              </h1>
              <p className="text-sm text-slate-500">
                Signed in as {user.name ?? user.email}
              </p>
            </div>

            <div className="flex-1" />

            <button
              type="button"
              onClick={newConversation}
              className="hidden rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:inline-block"
            >
              + New chat
            </button>
          </div>
        </header>

        <ChatMessages messages={messages} isLoading={isLoading} />

        <div className="border-t border-slate-800 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
          <div className="mx-auto max-w-3xl">
            <AgentSelector value={activeAgent} onChange={handleAgentChange} />
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={sendMessage}
              onStop={stopGenerating}
              onAttach={handleFileAttach}
              onVoiceToggle={toggleVoiceRecording}
              isLoading={isLoading}
              isUploading={isUploading}
              isRecording={isRecording}
              uploadingFileName={uploadingFileName ?? undefined}
              uploadStatus={uploadStatus ?? undefined}
              voiceStatus={voiceStatus ?? undefined}
              imagePreview={imagePreview}
              onRemoveImage={removeImage}
              disabled={isUploading}
            />
            <p className="mt-2 text-center text-[11px] text-slate-600">
              AI responses are generated by Google Gemini. Verify critical
              information.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
