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
  /** Phase 7 — tool id used to answer this message (e.g. "calculator"). */
  usedToolId?: string;
  /** Phase 7 — human-readable tool label for the UI (e.g. "🧮 Calculator"). */
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
  /** Titles of documents retrieved from the knowledge base (RAG). */
  retrievedDocumentTitles?: string[];
  /** Filesystem paths of the source documents (RAG). */
  sourcePaths?: string[];
  /** True when the RAG pipeline found and injected knowledge into the prompt. */
  ragUsed?: boolean;
};