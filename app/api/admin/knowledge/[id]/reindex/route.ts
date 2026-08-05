import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { logError } from "@/lib/logger";
import { validateIdParam, requireSession, chunkArray, jsonResponse } from "@/lib/api/utils";
import { sanitizePrompt } from "@/lib/sanitize";

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

  const authResp = requireSession(session);
  if (authResp) return authResp;

  const { id } = await context.params;
  const { valid, reason } = validateIdParam(sanitizePrompt(id));
  if (!valid) {
    return jsonResponse({ success: false, error: `Invalid document id: ${reason}` }, 400);
  }

  try {
    const provider = getEmbeddingProvider();
    if (!provider.isAvailable()) {
      return jsonResponse({ success: false, error: "Embedding provider unavailable" }, 503);
    }

    const document = await prisma.knowledgeDocument.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!document) return jsonResponse({ success: false, error: "Document not found" }, 404);

    // Find all chunks for this document.
    const chunks = await prisma.knowledgeChunk.findMany({
      where: { documentId: id },
      select: { id: true, content: true },
    });

    if (chunks.length === 0) return jsonResponse({ success: true, reindexed: 0 });

    // Batch embed and update rows in parallel with limited concurrency.
    const batchSize = 50;
    const chunkBatches = chunkArray(chunks, batchSize);
    let updated = 0;

    for (const batch of chunkBatches) {
      const texts = batch.map((c) => sanitizePrompt(c.content));
      const embeddings = await provider.embedBatch(texts);

      // Update DB entries concurrently but limit promises per batch.
      const updates = embeddings.map((embedding, i) => {
        if (!embedding) return Promise.resolve(null);
        return prisma.knowledgeChunk.update({ where: { id: batch[i].id }, data: { embedding } });
      });

      const results = await Promise.allSettled(updates);
      for (const r of results) if (r.status === "fulfilled" && r.value) updated++;
    }

    return jsonResponse({ success: true, reindexed: updated });
  } catch (error) {
    const userId = session?.user?.id ?? null;
    logError("Admin knowledge single re-index failed", {
      userId,
      documentId: id,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse({ success: false, error: "Re-index failed" }, 500);
  }
}