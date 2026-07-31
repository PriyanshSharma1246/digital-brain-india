import type { ChatMessage, ChatRole, Conversation } from "@/app/types/chat";

/**
 * Helper functions for client-side chat messages and conversation IDs.
 */

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
    id: `conv:${createId()}`,
    title,
    messages: [],
    updatedAt: Date.now(),
    isLocal: true,
  };
}

export type StoredMessage = {
  conversationId?: string;
  text: string;
  title?: string;
};

export function serializeStoredMessage(
  text: string,
  conversationId?: string,
  title?: string
): string {
  if (!conversationId && !title) return text;
  return JSON.stringify({ conversationId, text, title });
}

export function parseStoredMessage(raw: string): StoredMessage {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as any).text === "string"
    ) {
      return {
        conversationId: typeof (parsed as any).conversationId === "string" ? (parsed as any).conversationId : undefined,
        text: (parsed as any).text,
        title: typeof (parsed as any).title === "string" ? (parsed as any).title : undefined,
      };
    }
  } catch {
    // Fallback to plain text content.
  }
  return { text: raw };
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
  return [];
}

export function saveConversations(_conversations: Conversation[]): void {
  return;
}
