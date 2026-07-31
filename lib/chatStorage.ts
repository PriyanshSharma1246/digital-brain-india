import type { ChatMessage, ChatRole, Conversation } from "@/app/types/chat";

/**
 * Small localStorage helper for the chat sidebar history.
 *
 * NOTE: the existing /api/chat route already persists every message/reply
 * pair to Postgres via Prisma, but there is no GET endpoint to read them
 * back. To avoid touching the API or the Prisma schema, the sidebar history
 * is kept in the browser only.
 */

const STORAGE_KEY = "dbi:chat:conversations";

/** Safe id generator (works in browsers without crypto.randomUUID). */
export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createMessage(
  role: ChatRole,
  message: string,
  isError = false
): ChatMessage {
  return {
    id: createId(),
    role,
    message,
    createdAt: Date.now(),
    ...(isError ? { isError: true } : {}),
  };
}

export function createConversation(title = "New chat"): Conversation {
  return {
    id: createId(),
    title,
    messages: [],
    updatedAt: Date.now(),
  };
}

/** Turns the first user message into a short sidebar title. */
export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "New chat";
  return clean.length > 38 ? `${clean.slice(0, 38)}…` : clean;
}

function isConversation(value: unknown): value is Conversation {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Partial<Conversation>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    typeof c.updatedAt === "number" &&
    Array.isArray(c.messages)
  );
}

export function loadConversations(): Conversation[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isConversation)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export function saveConversations(conversations: Conversation[]): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Storage full / disabled – history simply won't persist.
  }
}
