"use client";

import { useRef, useEffect } from "react";
import type { ChatMessage } from "@/app/types/chat";
import ChatBubble from "./ChatBubble";
import TypingBubble from "./TypingBubble";

type ChatMessagesProps = {
  messages: ChatMessage[];
  isLoading: boolean;
};

/**
 * Scrollable message list with auto-scroll to the newest message.
 * Shows a typing indicator while the API is loading.
 */
export default function ChatMessages({
  messages,
  isLoading,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll whenever messages change or loading state changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div
      className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      role="log"
      aria-live="polite"
      aria-busy={isLoading}
    >
      {messages.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <div className="mb-4 text-5xl">🤖</div>
          <h2 className="text-xl font-semibold text-slate-200">
            How can I help you today?
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Ask any question — I&apos;ll do my best to answer with the help of
            Gemini AI.
          </p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              role={msg.role}
              message={msg.message}
              createdAt={msg.createdAt}
              isError={msg.isError}
              usedToolId={msg.usedToolId}
              usedToolLabel={msg.usedToolLabel}
            />
          ))}

          {/* Typing indicator */}
          {isLoading && <TypingBubble />}
        </div>
      )}

      {/* Invisible anchor for auto-scroll */}
      <div ref={bottomRef} />
    </div>
  );
}