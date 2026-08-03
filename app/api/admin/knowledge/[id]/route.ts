import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getKnowledgeDocumentDetail } from "@/lib/knowledge/admin";
import { logError } from "@/lib/logger";

/**
 * Admin Knowledge Document Detail API.
 *
 * GET /api/admin/knowledge/[id] -> full document metadata, markdown body,
 *                                  and ordered chunks with lengths.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const document = await getKnowledgeDocumentDetail(id);
    if (!document) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, document });
  } catch (error) {
    logError("Admin knowledge detail fetch failed", {
      userId: session.user.id,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Unable to load document" }, { status: 500 });
  }
}