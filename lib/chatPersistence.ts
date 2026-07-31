import { prisma } from "@/lib/prisma";

const META_PREFIX = "__chat_meta__";

export type ConversationRowMeta = {
  type: "conversation" | "message" | "rename" | "delete" | "file";
  conversationId: string;
  title?: string;
  fileName?: string;
};

export function encodeConversationMeta(
  conversationId: string,
  title: string,
  userMessage: string
): string {
  const metadata = JSON.stringify({
    type: "conversation",
    conversationId,
    title,
  });
  return `${META_PREFIX}${metadata}\n${userMessage}`;
}

export function encodeMessageEntry(conversationId: string, userMessage: string): string {
  const metadata = JSON.stringify({
    type: "message",
    conversationId,
  });
  return `${META_PREFIX}${metadata}\n${userMessage}`;
}

export function encodeFileEntry(
  conversationId: string,
  fileName: string,
  extractedText: string
): string {
  const metadata = JSON.stringify({
    type: "file",
    conversationId,
    fileName,
  });
  return `${META_PREFIX}${metadata}\n${extractedText}`;
}

export function encodeRenameEntry(conversationId: string, title: string): string {
  const metadata = JSON.stringify({
    type: "rename",
    conversationId,
    title,
  });
  return `${META_PREFIX}${metadata}`;
}

export function encodeDeleteEntry(conversationId: string): string {
  const metadata = JSON.stringify({
    type: "delete",
    conversationId,
  });
  return `${META_PREFIX}${metadata}`;
}

export function parseChatMessage(raw: string): {
  meta: ConversationRowMeta | null;
  message: string;
} {
  if (typeof raw !== "string" || !raw.startsWith(META_PREFIX)) {
    return { meta: null, message: raw };
  }

  const newlineIndex = raw.indexOf("\n");
  const metaString = newlineIndex === -1 ? raw.slice(META_PREFIX.length) : raw.slice(META_PREFIX.length, newlineIndex);
  try {
    const payload = JSON.parse(metaString) as Partial<ConversationRowMeta>;
    if (!payload?.type || !payload.conversationId) {
      return { meta: null, message: raw };
    }
    return {
      meta: {
        type: payload.type as ConversationRowMeta["type"],
        conversationId: payload.conversationId,
        title: payload.title,
        fileName: payload.fileName,
      },
      message: newlineIndex === -1 ? "" : raw.slice(newlineIndex + 1),
    };
  } catch {
    return { meta: null, message: raw };
  }
}

export async function getUserChats(userId: string) {
  return prisma.chat.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
}

export async function getConversationFiles(userId: string, conversationId: string) {
  const rows = await getUserChats(userId);
  return rows
    .map((row) => {
      const { meta, message } = parseChatMessage(row.message);
      if (meta?.type === "file" && meta.conversationId === conversationId) {
        return {
          fileName: meta.fileName ?? "attachment",
          text: message,
        };
      }
      return null;
    })
    .filter((file): file is { fileName: string; text: string } => file !== null);
}

export async function deleteConversationRows(userId: string, conversationId: string) {
  const rows = await getUserChats(userId);
  const deleteIds = rows.filter((row) => {
    const { meta } = parseChatMessage(row.message);
    return meta?.conversationId === conversationId;
  }).map((row) => row.id);

  if (deleteIds.length === 0) return;

  await prisma.chat.deleteMany({
    where: { id: { in: deleteIds } },
  });
}
