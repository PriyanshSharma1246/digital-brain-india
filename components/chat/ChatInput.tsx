"use client";

import { useRef, useEffect, useState } from "react";
import Spinner from "@/components/ui/Spinner";

type ChatInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
};

/**
 * Auto-resizing textarea + Send button.
 * Enter sends, Shift+Enter inserts a newline.
 */
export default function ChatInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled = false,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  // Auto-resize the textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`; // cap at 200px
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  }

  const canSend = value.trim().length > 0 && !isLoading && !disabled;

  return (
    <div
      className={`flex items-end gap-3 rounded-2xl border bg-slate-800/60 px-4 py-3 transition focus-within:ring-2 focus-within:ring-blue-500/50 ${
        focused ? "border-blue-500/50" : "border-slate-700"
      }`}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Ask anything... Enter to send, Shift+Enter for newline"
        rows={1}
        autoFocus
        aria-multiline="true"
        disabled={isLoading || disabled}
        className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent text-[15px] text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50"
        aria-label="Chat message"
      />

      <button
        type="button"
        onClick={onSend}
        disabled={!canSend}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Send message"
      >
        {isLoading ? (
          <Spinner className="h-5 w-5" label="Sending" />
        ) : (
          /* Arrow-up icon */
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="h-5 w-5"
          >
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        )}
      </button>
    </div>
  );
}