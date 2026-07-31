"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, ChatApiResponse } from "@/app/types/chat";
import {
  loadConversations,
  saveConversations,
  createConversation,
  createMessage,
  deriveTitle,
} from "@/lib/chatStorage";
import type { Conversation } from "@/app/types/chat";
import ChatSidebar from "@/components/chat/ChatSidebar";
import ChatMessages from "@/components/chat/ChatMessages";
import ChatInput from "@/components/chat/ChatInput";

export default function ChatPage() {
  /* ---------- hydration guard ---------- */
  const [hydrated, setHydrated] = useState(false);

  /* ---------- sidebar state ---------- */
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ---------- conversations ---------- */
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  /* ---------- active conversation shortcut ---------- */
  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;
  const messages = activeConversation?.messages ?? [];

  /* ---------- input / loading ---------- */
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /* ========== hydrate from localStorage ========== */
  useEffect(() => {
    const saved = loadConversations();
    setConversations(saved);

    // If there are saved conversations, select the most recent one.
    // Otherwise, create a fresh empty conversation (but don't persist
    // until the first message is sent).
    if (saved.length > 0) {
      setActiveId(saved[0].id);
    } else {
      const fresh = createConversation();
      setConversations([fresh]);
      setActiveId(fresh.id);
    }

    setHydrated(true);
  }, []);

  /* ========== persist whenever conversations change ========== */
  useEffect(() => {
    if (!hydrated) return;
    saveConversations(conversations);
  }, [conversations, hydrated]);

  /* ========== helpers ========== */

  /** Replace the active conversation's messages array, update timestamps, sort. */
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

  /** Create a brand-new conversation and switch to it. */
  function newConversation() {
    const fresh = createConversation();
    setConversations((prev) => [fresh, ...prev]);
    setActiveId(fresh.id);
    setInput("");
    setSidebarOpen(false);
  }

  /** Delete a conversation by id. */
  function deleteConversation(id: string) {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // If we deleted the active one, switch to the first remaining
      if (activeId === id) {
        setActiveId(next.length > 0 ? next[0].id : null);
        // If no conversations left, seed a fresh one
        if (next.length === 0) {
          const fresh = createConversation();
          setActiveId(fresh.id);
          return [fresh];
        }
      }
      return next;
    });
  }

  /** Send the current input to the /api/chat endpoint. */
  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    // Ensure we have an active conversation
    let currentId = activeId;
    let currentConversation = activeConversation;

    if (!currentConversation) {
      const fresh = createConversation(deriveTitle(text));
      setConversations((prev) => [fresh, ...prev]);
      setActiveId(fresh.id);
      currentId = fresh.id;
      currentConversation = fresh;
    }

    // Update the title from the first user message if it's still "New chat"
    if (currentConversation.title === "New chat" && currentConversation.messages.length === 0) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentId ? { ...c, title: deriveTitle(text) } : c
        )
      );
    }

    // Insert user message
    const userMsg = createMessage("user", text);
    updateMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data: ChatApiResponse = await res.json();

      if (data.success && data.reply) {
        updateMessages((prev) => [...prev, createMessage("assistant", data.reply ?? "No response from Gemini.")]);
      } else {
        updateMessages((prev) => [
          ...prev,
          createMessage("assistant", data.error ?? "No response from Gemini.", true),
        ]);
      }
    } catch {
      updateMessages((prev) => [
        ...prev,
        createMessage("assistant", "❌ Failed to contact AI. Please check your connection and try again.", true),
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  /* ========== render ========== */

  // Avoid SSR mismatch by showing nothing until hydrated
  if (!hydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </main>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-white">
      {/* ---------- Sidebar ---------- */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        isOpen={sidebarOpen}
        onSelect={(id) => {
          setActiveId(id);
          setInput("");
        }}
        onNew={newConversation}
        onDelete={deleteConversation}
        onClose={() => setSidebarOpen(false)}
      />

      {/* ---------- Main chat area ---------- */}
      <main className="flex flex-1 flex-col" aria-label="Chat interface">
        {/* Top bar */}
        <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 sm:px-6">
          {/* Hamburger – mobile only */}
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

          <h1 className="text-lg font-semibold text-slate-200">
            {activeConversation?.title ?? "AI Chat"}
          </h1>

          {/* Spacer */}
          <div className="flex-1" />

          {/* New chat button (desktop shortcut) */}
          <button
            type="button"
            onClick={newConversation}
            className="hidden rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700 sm:inline-block"
          >
            + New chat
          </button>
        </header>

        {/* ---------- Messages ---------- */}
        <ChatMessages messages={messages} isLoading={isLoading} />

        {/* ---------- Input ---------- */}
        <div className="border-t border-slate-800 px-4 pb-4 pt-3 sm:px-6 sm:pb-6">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              value={input}
              onChange={setInput}
              onSend={sendMessage}
              isLoading={isLoading}
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