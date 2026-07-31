"use client";

import type { Conversation } from "@/app/types/chat";

type ChatSidebarProps = {
  conversations: Conversation[];
  activeId: string | null;
  isOpen: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
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
  onClose,
}: ChatSidebarProps) {
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
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            History
          </h2>
          <button
            type="button"
            onClick={onNew}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            + New
          </button>
        </div>

        {/* Conversation list */}
        <nav className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="mt-8 text-center text-sm text-slate-500">
              No conversations yet
            </p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((c) => {
                const isActive = c.id === activeId;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(c.id);
                        onClose();
                      }}
                      className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                        isActive
                          ? "bg-blue-600/20 text-blue-300 ring-1 ring-blue-600/40"
                          : "text-slate-300 hover:bg-slate-800"
                      }`}
                    >
                      <span className="line-clamp-1">{c.title}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">
                        {formatDate(c.updatedAt)}
                      </span>
                    </button>

                    {/* Delete button – only visible on hover */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                      className="ml-1 mt-0.5 text-[11px] text-slate-600 transition hover:text-red-400"
                      aria-label={`Delete ${c.title}`}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* Close button – mobile only */}
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