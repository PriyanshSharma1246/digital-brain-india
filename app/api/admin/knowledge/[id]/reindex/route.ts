import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { logError } from "@/lib/logger";

/**
 * Admin Knowledge Single-Document Re-index API (Phase 9).
 *
 * POST /api/admin/knowledge/[id]/reindex -> re-index one document's chunks
 *
 * Regenerates embeddings for all chunks of a single document using the
 * active embedding provider. Returns the number of chunks re-indexed.
 */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, context: RouteContext) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const provider = getEmbeddingProvider();
    if (!provider.isAvailable()) {
      return NextResponse.json(
        { success: false, error: "Embedding provider unavailable" },
        { status: 400 }
      );
    }

    const document = await prisma.knowledgeDocument.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!document) {
      return NextResponse.json({ success: false, error: "Document not found" }, { status: 404 });
    }

    // Find all chunks for this document.
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { documentId: id },
      select: { id: true, content: true },
    });

    if (chunks.length === 0) {
      return NextResponse.json({ success: true, reindexed: 0 });
    }

    // Generate embeddings in batches.
    const embeddings = await provider.embedBatch(chunks.map((c) => c.content));

    // Update each chunk with its new embedding (skip nulls).
    let updated = 0;
    for (let i = 0; i < chunks.length; i++) {
      const embedding = embeddings[i];
      if (!embedding) continue;
      await prisma.knowledgeChunk.update({
        where: { id: chunks[i].id },
        data: { embedding },
      });
      updated++;
    }

    return NextResponse.json({ success: true, reindexed: updated });
  } catch (error) {
    logError("Admin knowledge single re-index failed", {
      userId: session.user.id,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Re-index failed" }, { status: 500 });
  }
}