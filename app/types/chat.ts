/**
 * Shared chat types used by the chat UI (client-side only).
 * These mirror the shape returned by the existing /api/chat route
 * (`{ success, reply, chatId }`) without changing it.
 */

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  message: string;
  /** epoch ms – used for the small timestamp under each bubble */
  createdAt: number;
  /** true when the bubble represents a failed request */
  isError?: boolean;
};

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** epoch ms of the last activity – used to sort the sidebar */
  updatedAt: number;
  /** true for a locally-created conversation that has not yet been persisted */
  isLocal?: boolean;
};

export type ConversationResponse = {
  conversations: Conversation[];
};

/** Response body of POST /api/chat */
export type ChatApiResponse = {
  success: boolean;
  reply?: string;
  chatId?: string;
  conversationId?: string;
  error?: string;
};
