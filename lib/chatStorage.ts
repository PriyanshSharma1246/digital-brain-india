import type { ChatMessage, ChatRole, Conversation } from "@/app/types/chat";

/**
 * Local storage helper for the chat sidebar history.
 */

const STORAGE_KEY = "dbi:chat:conversations";
const METADATA_KEY = "dbi:chat:conversation-metadata";

export type ConversationMetadata = Record<
  string,
  {
    title: string;
  }
>;

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
    id: `local:${createId()}`,
    title,
    messages: [],
    updatedAt: Date.now(),
  };
}

export function loadConversationMetadata(): ConversationMetadata {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(METADATA_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as ConversationMetadata;
  } catch {
    return {};
  }
}

export function saveConversationMetadata(metadata: ConversationMetadata): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(METADATA_KEY, JSON.stringify(metadata));
  } catch {
    // Ignore storage failures.
  }
}

export function applyConversationMetadata(
  conversations: Conversation[],
  metadata: ConversationMetadata
): Conversation[] {
  return conversations.map((conversation) => {
    const override = metadata[conversation.id];
    if (!override) return conversation;
    return { ...conversation, title: override.title };
  });
}

export function setConversationTitle(id: string, title: string): void {
  const metadata = loadConversationMetadata();
  saveConversationMetadata({
    ...metadata,
    [id]: { title },
  });
}

export function deleteConversationMetadata(id: string): void {
  const metadata = loadConversationMetadata();
  if (!(id in metadata)) return;
  const next = { ...metadata };
  delete next[id];
  saveConversationMetadata(next);
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
