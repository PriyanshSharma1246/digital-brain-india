import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createConversation,
  listConversations,
  logConversationError,
} from "@/lib/conversations";
import { sanitizeTextInput } from "@/lib/sanitize";

/**
 * Conversation collection API.
 *
 * GET  /api/conversations      -> list conversations (newest activity first)
 * POST /api/conversations      -> create a new conversation
 *
 * All endpoints require an authenticated session.
 */

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversations = await listConversations(session.user.id);
    return NextResponse.json({ success: true, conversations });
  } catch (error) {
    logConversationError(session.user.id, "list", error);
    return NextResponse.json({ success: false, error: "Unable to list conversations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    const title = sanitizeTextInput(
      typeof body.title === "string" ? body.title : "New chat",
      { maxLength: 160 }
    );

    const conversation = await createConversation(session.user.id, title || "New chat");
    return NextResponse.json({ success: true, conversation }, { status: 201 });
  } catch (error) {
    logConversationError(session.user.id, "create", error);
    return NextResponse.json({ success: false, error: "Unable to create conversation" }, { status: 500 });
  }
}