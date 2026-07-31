"use client";

import { useMemo, useState } from "react";
import type { Conversation } from "@/app/types/chat";

type ChatSidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onToggle: () => void;
  onClose: () => void;
};

function formatDate(epochMs: number): string {
  const d = new Date(epochMs);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / 86_400_000);

  if (days === 0) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getGroupLabel(dateMs: number) {
  const d = new Date(dateMs);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  if (d >= startOfToday) return "Today";
  if (d >= startOfYesterday) return "Yesterday";
  return "Older";
}

/**
 * Slide-over conversation history sidebar for the chat page.
 * Also rendered as a mobile overlay via `isOpen` + `onClose`.
 */
export default function ChatSidebar({
  conversations,
  activeId,
  isOpen,
  onSelect,
  onNew,
  onDelete,
  onRename,
  onToggle,
  onClose,
}: ChatSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const groups = useMemo(() => {
    return conversations.reduce<Record<string, Conversation[]>>(
      (acc, conversation) => {
        const label = getGroupLabel(conversation.updatedAt);
        acc[label] = acc[label] ?? [];
        acc[label].push(conversation);
        return acc;
      },
      {}
    );
  }, [conversations]);

  const groupOrder = ["Today", "Yesterday", "Older"];

  function beginRename(conversation: Conversation) {
    setEditingId(conversation.id);
    setDraftTitle(conversation.title);
  }

  function finishRename(id: string) {
    const trimmed = draftTitle.trim() || "New chat";
    onRename(id, trimmed);
    setEditingId(null);
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 sm:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 flex h-full w-72 flex-col bg-slate-900 border-r border-slate-800 transition-transform duration-300 sm:static sm:z-auto sm:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-4">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg bg-slate-800 px-2 py-2 text-slate-300 transition hover:bg-slate-700 sm:hidden"
            aria-label="Toggle sidebar"
          >
            {isOpen ? "Close" : "Open"}
          </button>

          <div className="flex-1">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Conversations
            </h2>
            <p className="text-xs text-slate-500">Saved locally in browser storage</p>
          </div>

          <button
            type="button"
            onClick={onNew}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            + New
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              No conversations yet
            </p>
          ) : (
            groupOrder.map((group) => {
              const items = groups[group] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-4 last:mb-0">
                  <div className="px-3 pb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                    {group}
                  </div>
                  <ul className="space-y-2">
                    {items.map((c) => {
                      const isActive = c.id === activeId;
                      return (
                        <li key={c.id} className="group rounded-2xl bg-slate-950/20 p-2 transition hover:bg-slate-800">
                          <div className="flex items-start gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                onSelect(c.id);
                              }}
                              className={`min-w-0 flex-1 text-left text-sm transition ${
                                isActive
                                  ? "text-blue-300"
                                  : "text-slate-300 hover:text-white"
                              }`}
                            >
                              {editingId === c.id ? (
                                <input
                                  value={draftTitle}
                                  onChange={(event) => setDraftTitle(event.target.value)}
                                  onBlur={() => finishRename(c.id)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      finishRename(c.id);
                                    }
                                  }}
                                  autoFocus
                                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-sm text-slate-100 outline-none focus:border-blue-500"
                                />
                              ) : (
                                <span className="line-clamp-2 block font-medium">{c.title}</span>
                              )}
                              <span className="mt-1 block text-[11px] text-slate-500">
                                {formatDate(c.updatedAt)}
                              </span>
                            </button>

                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  beginRename(c);
                                }}
                                className="rounded-md px-2 py-1 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                              >
                                Rename
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  onDelete(c.id);
                                }}
                                className="rounded-md px-2 py-1 text-[11px] text-red-400 transition hover:bg-slate-800 hover:text-red-200"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </nav>

        <button
          type="button"
          onClick={onClose}
          className="border-t border-slate-800 py-3 text-sm text-slate-400 transition hover:text-white sm:hidden"
        >
          Close sidebar
        </button>
      </aside>
    </>
  );
}