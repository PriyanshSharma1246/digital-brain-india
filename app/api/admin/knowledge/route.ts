import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  deleteKnowledgeDocument,
  getKnowledgeAnalytics,
  getKnowledgeDashboardStats,
  getKnowledgeQualitySummary,
  listKnowledgeDocuments,
  safeReIndexMissingEmbeddings,
  safeReIngestKnowledgeBase,
} from "@/lib/knowledge/admin";
import { logError } from "@/lib/logger";
import { requireSession } from "@/lib/api/utils";
import { sanitizePrompt } from "@/lib/sanitize";

/**
 * Admin Knowledge Management API.
 *
 * GET    /api/admin/knowledge?search=...  -> dashboard stats + document list
 * GET    /api/admin/knowledge?view=analytics -> analytics dashboard
 * GET    /api/admin/knowledge?view=quality   -> quality check summary
 * POST   /api/admin/knowledge             -> re-ingest the knowledge corpus
 * POST   /api/admin/knowledge?action=reindex -> re-index chunks missing embeddings
 * DELETE /api/admin/knowledge?id=...      -> delete one document + its chunks
 *
 * All endpoints require an authenticated session.
 */

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const authResp = requireSession(session);
  if (authResp) return authResp;

  try {
    const { searchParams } = new URL(req.url);
    const search = sanitizePrompt(searchParams.get("search") ?? "");
    const view = searchParams.get("view");

    // GET /api/admin/knowledge?view=analytics -> analytics dashboard
    if (view === "analytics") {
      const analytics = await getKnowledgeAnalytics();
      return NextResponse.json({ success: true, analytics });
    }

    // GET /api/admin/knowledge?view=quality -> quality check summary
    if (view === "quality") {
      const quality = await getKnowledgeQualitySummary();
      return NextResponse.json({ success: true, quality });
    }

    const [stats, documents] = await Promise.all([
      getKnowledgeDashboardStats(),
      listKnowledgeDocuments(search),
    ]);

    return NextResponse.json({ success: true, stats, documents });
  } catch (error) {
    const userId = session?.user?.id ?? null;
    logError("Admin knowledge list failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Unable to load knowledge dashboard" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const authResp = requireSession(session);
  if (authResp) return authResp;

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // POST /api/admin/knowledge?action=reindex -> re-index chunks missing embeddings
    if (action === "reindex") {
      const reindexed = await safeReIndexMissingEmbeddings();
      return NextResponse.json({ success: true, reindexed });
    }

    // POST /api/admin/knowledge -> re-ingest the knowledge corpus
    // Reuse the existing ingestion pipeline (lib/knowledge/ingest) — no
    // parsing/splitting logic is duplicated here.
    const result = await safeReIngestKnowledgeBase();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const userId = session?.user?.id ?? null;
    logError("Admin knowledge re-ingest failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Re-ingestion failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const authResp = requireSession(session);
  if (authResp) return authResp;

  const { searchParams } = new URL(req.url);
  const id = sanitizePrompt(searchParams.get("id") ?? undefined);
  if (!id) return NextResponse.json({ success: false, error: "Missing document id" }, { status: 400 });

  try {
    // Deletes the document and its chunks atomically (see lib/knowledge/admin).
    await deleteKnowledgeDocument(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const userId = session?.user?.id ?? null;
    logError("Admin knowledge delete failed", {
      userId,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Unable to delete document" }, { status: 500 });
  }
}