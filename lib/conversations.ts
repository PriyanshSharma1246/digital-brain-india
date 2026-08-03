import { prisma } from "@/lib/prisma";
import { deriveTitle } from "@/lib/chatStorage";
import { logError } from "@/lib/logger";

/**
 * Persistent conversation memory service (Phase 4).
 *
 * This service owns all CRUD for Conversation / Message rows and is used by
 * the `/api/conversations` REST endpoints. It intentionally does NOT depend on
 * Gemini or the existing `/api/chat` pipeline — integrations land in a later
 * phase after RAG verification.
 */

export type ConversationSummary = {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ConversationMessage = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  isError: boolean;
  createdAt: Date;
};

export type MessagePage = {
  messages: ConversationMessage[];
  /** Page metadata for cursor-style pagination (newest-last ordering). */
  pageSize: number;
  /** 1-based page number of this response. */
  page: number;
  /** Total messages in the conversation. */
  total: number;
  /** Whether older messages exist before this page. */
  hasMore: boolean;
};

/** Creates a new conversation owned by the given user. Returns the summary. */
export async function createConversation(
  userId: string,
  title = "New chat"
): Promise<ConversationSummary> {
  const conversation = await prisma.conversation.create({
    data: { userId, title },
  });
  return {
    id: conversation.id,
    title: conversation.title,
    userId: conversation.userId,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
  };
}

/** Fetches a single conversation owned by the user, or null. */
export async function getConversation(
  userId: string,
  conversationId: string
): Promise<ConversationSummary | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    select: {
      id: true,
      title: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return conversation;
}

/** Lists conversations for a user, newest activity first. */
export async function listConversations(userId: string): Promise<ConversationSummary[]> {
  return prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      userId: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** Renames a conversation (ownership-checked) and bumps updatedAt. */
export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string
): Promise<ConversationSummary | null> {
  const trimmed = title.trim() || "New chat";
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conversation) return null;

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: { title: trimmed },
  });

  return {
    id: updated.id,
    title: updated.title,
    userId: updated.userId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/** Deletes a conversation and all its messages (cascade). */
export async function deleteConversation(
  userId: string,
  conversationId: string
): Promise<boolean> {
  const existing = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!existing) return false;

  await prisma.conversation.delete({ where: { id: conversationId } });
  return true;
}

/**
 * Appends a message to a conversation (ownership-checked) and touches updatedAt.
 * If the conversation title is still "New chat" and it's a user message, the
 * title is derived from the first user message.
 */
export async function addMessage(
  userId: string,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  isError = false
): Promise<ConversationMessage | null> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conversation) return null;

  const message = await prisma.message.create({
    data: {
      conversationId,
      role,
      content,
      isError,
    },
  });

  // Touch updatedAt (Prisma @updatedAt) so the sidebar sorts correctly.
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {},
  });

  // Derive the title from the first user message when it's still "New chat".
  if (role === "user" && conversation.title === "New chat") {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { title: deriveTitle(content) },
    });
  }

  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role as "user" | "assistant",
    content: message.content,
    isError: message.isError,
    createdAt: message.createdAt,
  };
}

/**
 * Lists messages for a conversation with offset pagination.
 *
 * Ordering is oldest-first so the client renders newest messages last
 * (matching the existing chat UI). `page` is 1-based; `pageSize` caps each
 * response. `hasMore` indicates older messages exist on earlier pages.
 */
export async function listMessages(
  userId: string,
  conversationId: string,
  options: { page?: number; pageSize?: number } = {}
): Promise<MessagePage | null> {
  const { page = 1, pageSize = 50 } = options;
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)));

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });
  if (!conversation) return null;

  const total = await prisma.message.count({
    where: { conversationId },
  });

  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  });

  return {
    messages: messages.map((message) => ({
      id: message.id,
      conversationId: message.conversationId,
      role: message.role as "user" | "assistant",
      content: message.content,
      isError: message.isError,
      createdAt: message.createdAt,
    })),
    pageSize: safePageSize,
    page: safePage,
    total,
    hasMore: safePage * safePageSize < total,
  };
}

/** Logs a conversation operation error with context. */
export function logConversationError(
  userId: string,
  conversationId: string,
  error: unknown
): void {
  logError("Conversation operation failed", {
    userId,
    conversationId,
    error: error instanceof Error ? error.message : String(error),
  });
}
