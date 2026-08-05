import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Knowledge analytics service (Phase 9).
 *
 * Tracks and reports:
 *   - Most searched topics
 *   - Failed searches
 *   - Retrieval latency
 *   - Embedding coverage
 *   - Document count
 *   - Chunk count
 *   - Category distribution
 */

/** Fetches the most searched topics (by query frequency). */
export async function getMostSearchedTopics(limit = 10): Promise<
  { query: string; count: number }[]
> {
  const events = await prisma.searchEvent.findMany({
    where: { success: true },
    select: { query: true },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const counts = new Map<string, number>();
  for (const event of events) {
    const key = event.query.toLowerCase().trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([query, count]) => ({ query, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Fetches failed search statistics. */
export async function getFailedSearchStats(): Promise<{
  total: number;
  failed: number;
  failureRate: number;
}> {
  const [total, failed] = await Promise.all([
    prisma.searchEvent.count(),
    prisma.searchEvent.count({ where: { success: false } }),
  ]);

  return {
    total,
    failed,
    failureRate: total > 0 ? (failed / total) * 100 : 0,
  };
}

/** Fetches retrieval latency statistics. */
export async function getRetrievalLatencyStats(): Promise<{
  averageMs: number;
  p95Ms: number;
  maxMs: number;
}> {
  const events = await prisma.searchEvent.findMany({
    select: { latencyMs: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  if (events.length === 0) {
    return { averageMs: 0, p95Ms: 0, maxMs: 0 };
  }

  const latencies = events.map((e) => e.latencyMs).sort((a, b) => a - b);
  const averageMs = Math.round(
    latencies.reduce((sum, ms) => sum + ms, 0) / latencies.length
  );
  const p95Index = Math.min(
    latencies.length - 1,
    Math.ceil(latencies.length * 0.95) - 1
  );
  const maxMs = latencies[latencies.length - 1] ?? 0;

  return { averageMs, p95Ms: latencies[p95Index] ?? 0, maxMs };
}

/** Fetches embedding coverage statistics. */
export async function getEmbeddingCoverage(): Promise<{
  totalChunks: number;
  embeddedChunks: number;
  coveragePercent: number;
}> {
  const [totalChunks, embeddedChunks] = await Promise.all([
    prisma.knowledgeChunk.count(),
    prisma.knowledgeChunk.count({
      where: { embedding: { not: Prisma.DbNull } },
    }),
  ]);

  return {
    totalChunks,
    embeddedChunks,
    coveragePercent: totalChunks > 0 ? (embeddedChunks / totalChunks) * 100 : 0,
  };
}

/** Fetches document and chunk counts. */
export async function getDocumentStats(): Promise<{
  documentCount: number;
  chunkCount: number;
}> {
  const [documentCount, chunkCount] = await Promise.all([
    prisma.knowledgeDocument.count(),
    prisma.knowledgeChunk.count(),
  ]);

  return { documentCount, chunkCount };
}

/** Fetches category distribution across documents. */
export async function getCategoryDistribution(): Promise<
  { category: string; count: number }[]
> {
  const documents = await prisma.knowledgeDocument.findMany({
    select: { category: true },
  });

  const counts = new Map<string, number>();
  for (const doc of documents) {
    counts.set(doc.category, (counts.get(doc.category) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/** Fetches the full analytics dashboard payload. */
export async function getAnalyticsDashboard() {
  const [
    mostSearched,
    failedSearchStats,
    latencyStats,
    embeddingCoverage,
    documentStats,
    categoryDistribution,
  ] = await Promise.all([
    getMostSearchedTopics(),
    getFailedSearchStats(),
    getRetrievalLatencyStats(),
    getEmbeddingCoverage(),
    getDocumentStats(),
    getCategoryDistribution(),
  ]);

  return {
    mostSearched,
    failedSearchStats,
    latencyStats,
    embeddingCoverage,
    documentStats,
    categoryDistribution,
  };
}