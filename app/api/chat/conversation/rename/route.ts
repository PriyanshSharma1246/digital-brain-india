import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encodeRenameEntry } from "@/lib/chatPersistence";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId, title } = await req.json();

    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json({ success: false, error: "Conversation ID is required" }, { status: 400 });
    }

    if (!title || typeof title !== "string") {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    await prisma.chat.create({
      data: {
        message: encodeRenameEntry(conversationId, title),
        reply: "",
        userId: session.user.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Rename conversation error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
