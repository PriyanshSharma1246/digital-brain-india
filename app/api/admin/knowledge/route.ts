import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteKnowledgeDocument,
  getKnowledgeDashboardStats,
  listKnowledgeDocuments,
  safeReIngestKnowledgeBase,
} from "@/lib/knowledge/admin";
import { logError } from "@/lib/logger";

/**
 * Admin Knowledge Management API.
 *
 * GET    /api/admin/knowledge?search=...  -> dashboard stats + document list
 * POST   /api/admin/knowledge             -> re-ingest the knowledge corpus
 * DELETE /api/admin/knowledge?id=...      -> delete one document + its chunks
 *
 * All endpoints require an authenticated session.
 */

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") ?? "";

    const [stats, documents] = await Promise.all([
      getKnowledgeDashboardStats(),
      listKnowledgeDocuments(search),
    ]);

    return NextResponse.json({ success: true, stats, documents });
  } catch (error) {
    logError("Admin knowledge list failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Unable to load knowledge dashboard" }, { status: 500 });
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Reuse the existing ingestion pipeline (lib/knowledge/ingest) — no
    // parsing/splitting logic is duplicated here.
    const result = await safeReIngestKnowledgeBase();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    logError("Admin knowledge re-ingest failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Re-ingestion failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing document id" }, { status: 400 });
  }

  try {
    // Deletes the document and its chunks atomically (see lib/knowledge/admin).
    await deleteKnowledgeDocument(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Admin knowledge delete failed", {
      userId: session.user.id,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Unable to delete document" }, { status: 500 });
  }
}