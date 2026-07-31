"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
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

function Code({
  inline,
  className,
  children,
}: {
  inline?: boolean;
  className?: string;
  children: any;
}) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? "").trimEnd();
  const languageMatch = /language-(\w+)/.exec(className || "");
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  if (inline) {
    return (
      <code className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[13px] text-slate-100">
        {code}
      </code>
    );
  }

  return (
    <div className="group relative my-4 overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-sm">
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-3 top-3 z-10 rounded-full bg-slate-800/95 px-3 py-1 text-[12px] text-slate-200 transition hover:bg-slate-700"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <pre className="m-0 overflow-x-auto bg-transparent p-4 text-[13px] leading-6">
        <code className={className}>{code}</code>
      </pre>
      {languageMatch ? (
        <div className="pointer-events-none absolute left-3 top-3 text-[11px] uppercase tracking-[0.15em] text-slate-400">
          {languageMatch[1]}
        </div>
      ) : null}
    </div>
  );
}

const markdownComponents = {
  a: (props: any) => (
    <a
      href={props.href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-blue-300 underline decoration-blue-400/50 transition hover:text-blue-200"
    >
      {props.children}
    </a>
  ),
  blockquote: (props: any) => (
    <blockquote className="my-4 rounded-xl border-l-4 border-slate-600 bg-slate-900/80 px-4 py-3 text-slate-200 italic">
      {props.children}
    </blockquote>
  ),
  h1: (props: any) => (
    <h1 className="mt-6 text-xl font-semibold text-slate-100">{props.children}</h1>
  ),
  h2: (props: any) => (
    <h2 className="mt-5 text-lg font-semibold text-slate-100">{props.children}</h2>
  ),
  h3: (props: any) => (
    <h3 className="mt-5 text-base font-semibold text-slate-100">{props.children}</h3>
  ),
  ul: (props: any) => (
    <ul className="my-3 ml-6 list-disc space-y-1 text-slate-200">{props.children}</ul>
  ),
  ol: (props: any) => (
    <ol className="my-3 ml-6 list-decimal space-y-1 text-slate-200">{props.children}</ol>
  ),
  li: (props: any) => <li className="leading-6">{props.children}</li>,
  p: (props: any) => (
    <p className="mb-3 leading-7 text-slate-200">{props.children}</p>
  ),
  table: (props: any) => (
    <div className="my-4 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950">
      <table className="min-w-full border-collapse text-sm">{props.children}</table>
    </div>
  ),
  th: (props: any) => (
    <th className="border border-slate-700 bg-slate-900 px-3 py-2 text-left font-semibold text-slate-100">
      {props.children}
    </th>
  ),
  td: (props: any) => (
    <td className="border border-slate-700 px-3 py-2 text-slate-200">{props.children}</td>
  ),
  code: Code,
} as any;

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
          className={`overflow-hidden rounded-2xl px-4 py-3 text-[15px] leading-relaxed shadow-sm ${
            isError
              ? "bg-red-950/60 text-red-200 ring-1 ring-red-800"
              : isUser
                ? "rounded-br-md bg-blue-600 text-white"
                : "rounded-bl-md bg-slate-800 text-slate-100 ring-1 ring-slate-700"
          }`}
        >
          {role === "assistant" ? (
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={markdownComponents}
              >
                {message}
              </ReactMarkdown>
            </div>
          ) : (
            <span className="whitespace-pre-wrap break-words">{message}</span>
          )}
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
