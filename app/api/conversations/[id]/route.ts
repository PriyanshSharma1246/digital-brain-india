import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteConversation,
  logConversationError,
  renameConversation,
} from "@/lib/conversations";
import { sanitizeTextInput } from "@/lib/sanitize";

/**
 * Conversation detail API.
 *
 * PATCH  /api/conversations/[id]  -> rename conversation
 * DELETE /api/conversations/[id]  -> delete conversation + its messages
 *
 * All operations are ownership-checked against the authenticated user.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = (await req.json().catch(() => ({}))) as { title?: unknown };
    const title = sanitizeTextInput(
      typeof body.title === "string" ? body.title : "",
      { maxLength: 160 }
    );
    if (!title.trim()) {
      return NextResponse.json({ success: false, error: "Title is required" }, { status: 400 });
    }

    const conversation = await renameConversation(session.user.id, id, title);
    if (!conversation) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, conversation });
  } catch (error) {
    logConversationError(session.user.id, id, error);
    return NextResponse.json({ success: false, error: "Unable to rename conversation" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteConversation(session.user.id, id);
    if (!deleted) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logConversationError(session.user.id, id, error);
    return NextResponse.json({ success: false, error: "Unable to delete conversation" }, { status: 500 });
  }
}