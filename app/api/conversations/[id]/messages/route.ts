import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listMessages, logConversationError } from "@/lib/conversations";

/**
 * Conversation messages API.
 *
 * GET /api/conversations/[id]/messages?page=1&pageSize=50
 *
 * Returns paginated messages ordered oldest-first (newest appears last).
 * All endpoints require an authenticated session and ownership of the
 * conversation.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("pageSize") ?? "50");

    const result = await listMessages(session.user.id, id, { page, pageSize });
    if (!result) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logConversationError(session.user.id, id, error);
    return NextResponse.json({ success: false, error: "Unable to load messages" }, { status: 500 });
  }
}