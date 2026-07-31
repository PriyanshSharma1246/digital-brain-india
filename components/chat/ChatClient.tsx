"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, Conversation, ConversationResponse } from "@/app/types/chat";
import { createConversation, createMessage, createId, deriveTitle } from "@/lib/chatStorage";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatMessages from "@/components/chat/ChatMessages";
import ChatInput from "@/components/chat/ChatInput";

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

  useEffect(() => {
    async function loadHistory() {
      setIsRefreshing(true);
      try {
        const res = await fetch("/api/chat/history");
        const data: ConversationResponse = await res.json();
        if (data.conversations?.length) {
          setConversations(data.conversations);
          setActiveId(data.conversations[0]?.id ?? null);
        } else {
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
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      setConversations((prev) => {
        const updated = prev.map((c) => {
          if (c.id !== activeId) return c;
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

  function newConversation() {
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInput("");
    setSidebarOpen(false);
  }

  async function deleteConversation(id: string) {
    try {
      await fetch("/api/chat/conversation/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id }),
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
    if (!text || isLoading || isUploading) return;

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

    const userMsg = createMessage("user", text);
    const assistantId = createId();
    const assistantMsg: ChatMessage = {
      ...createMessage("assistant", ""),
      id: assistantId,
    };

    updateMessages((prev) => [...prev, userMsg, assistantMsg]);
    setAssistantMessageId(assistantId);
    setInput("");
    setIsLoading(true);

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
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        const errorMessage =
          errorPayload?.error ||
          "Failed to stream AI response. Please try again.";
        updateAssistantMessage(errorMessage, true);
        return;
      }

      if (!response.body) {
        updateAssistantMessage(
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf("\n");

          if (!line) continue;

          try {
            const payload = JSON.parse(line);
            if (payload.type === "chunk" && typeof payload.text === "string") {
              partial += payload.text;
              updateAssistantMessage(partial);
            }

            if (payload.type === "done" && typeof payload.reply === "string") {
              finished = true;
              updateAssistantMessage(payload.reply);
            }

            if (payload.type === "error" && typeof payload.error === "string") {
              updateAssistantMessage(payload.error, true);
            }
          } catch {
            // Ignore invalid partial lines.
          }
        }
      }

      if (!finished && partial) {
        updateAssistantMessage(partial);
      }
    } catch (error: unknown) {
      const isAbort =
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name?: string }).name === "AbortError";

      if (!isAbort) {
        updateAssistantMessage(
          "❌ Failed to contact AI. Please check your connection and try again.",
          true
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
            await fetch("/api/chat/conversation/rename", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId: id, title }),
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
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={sendMessage}
              onStop={stopGenerating}
              onAttach={handleFileAttach}
              isLoading={isLoading}
              isUploading={isUploading}
              uploadingFileName={uploadingFileName ?? undefined}
              uploadStatus={uploadStatus ?? undefined}
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
