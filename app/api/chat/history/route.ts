import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseChatMessage } from "@/lib/chatPersistence";
import { deriveTitle } from "@/lib/chatStorage";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.chat.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const conversations = new Map<
    string,
    {
      id: string;
      title: string;
      messages: Array<{ id: string; role: string; message: string; createdAt: number; isError?: boolean }>;
      updatedAt: number;
    }
  >();

  for (const row of rows) {
    const { meta, message } = parseChatMessage(row.message);
    const conversationId = meta?.conversationId ?? "conv:legacy";
    const conversation = conversations.get(conversationId) ?? {
      id: conversationId,
      title: "New chat",
      messages: [],
      updatedAt: row.createdAt.getTime(),
    };

    if (meta?.type === "delete") {
      conversations.delete(conversationId);
      continue;
    }

    if (meta?.type === "rename" && meta.title) {
      conversation.title = meta.title;
      conversation.updatedAt = Math.max(conversation.updatedAt, row.createdAt.getTime());
      conversations.set(conversationId, conversation);
      continue;
    }

    if (meta?.type === "file") {
      const fileName = meta.fileName ?? "attachment";
      conversation.messages.push({
        id: `${row.id}-user`,
        role: "user",
        message: `Uploaded file: ${fileName}`,
        createdAt: row.createdAt.getTime(),
      });

      if (row.reply) {
        conversation.messages.push({
          id: `${row.id}-assistant`,
          role: "assistant",
          message: row.reply,
          createdAt: row.createdAt.getTime() + 1,
        });
      }

      conversation.updatedAt = Math.max(conversation.updatedAt, row.createdAt.getTime());
      conversations.set(conversationId, conversation);
      continue;
    }

    if (!meta?.type || meta.type === "conversation" || meta.type === "message") {
      if (meta?.type === "conversation" && meta.title) {
        conversation.title = meta.title;
      }

      const userText = message;
      if (userText) {
        conversation.messages.push({
          id: `${row.id}-user`,
          role: "user",
          message: userText,
          createdAt: row.createdAt.getTime(),
        });
      }

      if (row.reply) {
        conversation.messages.push({
          id: `${row.id}-assistant`,
          role: "assistant",
          message: row.reply,
          createdAt: row.createdAt.getTime() + 1,
        });
      }

      conversation.updatedAt = Math.max(conversation.updatedAt, row.createdAt.getTime());
      conversations.set(conversationId, conversation);
    }
  }

  const sortedConversations = Array.from(conversations.values())
    .map((conversation) => {
      if (conversation.title === "New chat" && conversation.messages.length > 0) {
        const firstUser = conversation.messages.find((message) => message.role === "user");
        if (firstUser) {
          conversation.title = deriveTitle(firstUser.message);
        }
      }
      return conversation;
    })
    .sort((a, b) => b.updatedAt - a.updatedAt);

  return NextResponse.json({ conversations: sortedConversations });
}
