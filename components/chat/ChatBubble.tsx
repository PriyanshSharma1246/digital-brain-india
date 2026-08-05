"use client";

import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
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
  /** Phase 7 — tool id used to answer (e.g. "calculator"). */
  usedToolId?: string;
  /** Phase 7 — human-readable tool label (e.g. "🧮 Calculator"). */
  usedToolLabel?: string;
  /** Phase 8 — all agents that participated in answering this message. */
  agents?: string[];
  /** Phase 8 — display names of participating agents. */
  agentNames?: string[];
  /** Phase 8 — icons of participating agents. */
  agentIcons?: string[];
  /** Phase 8 — all tool ids used across agents. */
  usedToolIds?: string[];
  /** Phase 8 — all tool labels used across agents. */
  usedToolLabels?: string[];
};

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type CodeProps = {
  inline?: boolean;
  className?: string;
  children?: ReactNode;
};

function Code({
  inline,
  className,
  children,
}: CodeProps) {
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

type MarkdownProps = {
  children?: ReactNode;
  href?: string;
  className?: string;
};

const markdownComponents: Record<string, React.ComponentType<MarkdownProps>> = {
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-blue-300 underline decoration-blue-400/50 transition hover:text-blue-200"
    >
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-4 rounded-xl border-l-4 border-slate-600 bg-slate-900/80 px-4 py-3 text-slate-200 italic">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <h1 className="mt-6 text-xl font-semibold text-slate-100">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-5 text-lg font-semibold text-slate-100">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-5 text-base font-semibold text-slate-100">{children}</h3>
  ),
  ul: ({ children }) => (
    <ul className="my-3 ml-6 list-disc space-y-1 text-slate-200">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-3 ml-6 list-decimal space-y-1 text-slate-200">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-6">{children}</li>,
  p: ({ children }) => (
    <p className="mb-3 leading-7 text-slate-200">{children}</p>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-2xl border border-slate-700 bg-slate-950">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-slate-700 bg-slate-900 px-3 py-2 text-left font-semibold text-slate-100">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border border-slate-700 px-3 py-2 text-slate-200">{children}</td>
  ),
  code: Code as React.ComponentType<MarkdownProps>,
};

/**
 * A single chat message bubble (user = right/blue, assistant = left/slate).
 * Backwards compatible with the previous version: `role` + `message` only.
 * Phase 8 — assistant bubbles can now show all participating agents and
 * all tool usage across agents.
 */
export default function ChatBubble({
  role,
  message,
  createdAt,
  isError = false,
  usedToolId,
  usedToolLabel,
  agents,
  agentNames,
  agentIcons,
  usedToolIds,
  usedToolLabels,
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

  function speakMessage() {
    if (typeof window === "undefined") return;
    const plainText = message
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/[#>*_`~]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!plainText) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.lang = "en-IN";
    window.speechSynthesis.speak(utterance);
  }

  // Phase 8 — collect all participating agents (deduplicated).
  const displayAgents = agents && agentNames && agentIcons
    ? agents.map((agentId, index) => ({
        id: agentId,
        name: agentNames[index] ?? agentId,
        icon: agentIcons[index] ?? "🤖",
      }))
    : [];

  // Phase 8 — collect all tool labels (deduplicated).
  const displayTools = usedToolIds && usedToolLabels
    ? usedToolIds.map((toolId, index) => ({
        id: toolId,
        label: usedToolLabels[index] ?? toolId,
      }))
    : [];

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
          className={`mt-1 flex flex-wrap items-center gap-2 px-1 text-[11px] text-slate-500 ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          {/* Phase 8 — participating agents */}
          {!isUser && displayAgents.length > 0 ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              {displayAgents.map((agent) => (
                <span
                  key={agent.id}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300"
                  title={`Agent: ${agent.name}`}
                >
                  <span aria-hidden="true">{agent.icon}</span>
                  {agent.name}
                </span>
              ))}
            </span>
          ) : null}

          {/* Phase 7 — tool usage indicator (single tool, backward compatible) */}
          {!isUser && usedToolId && usedToolLabel && displayTools.length === 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300"
              title={`Tool used: ${usedToolId}`}
            >
              {usedToolLabel}
            </span>
          ) : null}

          {/* Phase 8 — all tool usage across agents */}
          {!isUser && displayTools.length > 0 ? (
            <span className="inline-flex flex-wrap items-center gap-1">
              {displayTools.map((tool) => (
                <span
                  key={tool.id}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-300"
                  title={`Tool used: ${tool.id}`}
                >
                  {tool.label}
                </span>
              ))}
            </span>
          ) : null}

          {createdAt ? <span>{formatTime(createdAt)}</span> : null}

          {!isUser ? (
            <button
              type="button"
              onClick={speakMessage}
              className="opacity-0 transition hover:text-slate-300 focus:opacity-100 group-hover:opacity-100"
              aria-label="Speak message"
            >
              Speak
            </button>
          ) : null}

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