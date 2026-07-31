"use client";

import { useState } from "react";
import type { ChatRole } from "@/app/types/chat";

type ChatBubbleProps = {
  role: ChatRole;
  message: string;
  /** epoch ms – optional, renders a small timestamp */
  createdAt?: number;
  /** renders the bubble in a red "failed" style */
  isError?: boolean;
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * A single chat message bubble (user = right/blue, assistant = left/slate).
 * Backwards compatible with the previous version: `role` + `message` only.
 */
export default function ChatBubble({
  role,
  message,
  createdAt,
  isError = false,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const [copied, setCopied] = useState(false);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked – ignore silently.
    }
  }

  return (
    <div
      className={`group flex w-full items-start gap-3 ${
        isUser ? "flex-row-reverse" : "flex-row"
      }`}
    >
      {/* Avatar */}
      <div
        className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-slate-800 text-blue-400 ring-1 ring-slate-700"
        }`}
        aria-hidden="true"
      >
        {isUser ? "You" : "AI"}
      </div>

      <div
        className={`flex min-w-0 max-w-[85%] flex-col sm:max-w-[75%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
            isError
              ? "bg-red-950/60 text-red-200 ring-1 ring-red-800"
              : isUser
                ? "rounded-br-md bg-blue-600 text-white"
                : "rounded-bl-md bg-slate-800 text-slate-100 ring-1 ring-slate-700"
          }`}
        >
          {message}
        </div>

        <div
          className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-500 ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {createdAt ? <span>{formatTime(createdAt)}</span> : null}

          <button
            type="button"
            onClick={copyMessage}
            className="opacity-0 transition hover:text-slate-300 focus:opacity-100 group-hover:opacity-100"
            aria-label="Copy message"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
