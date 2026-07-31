import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteConversationRows } from "@/lib/chatPersistence";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = await req.json();
    if (!conversationId || typeof conversationId !== "string") {
      return NextResponse.json({ success: false, error: "Conversation ID is required" }, { status: 400 });
    }

    await deleteConversationRows(session.user.id, conversationId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}
