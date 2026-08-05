import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "./embeddings";
import { logError } from "@/lib/logger";
import type { SearchFilters } from "@/lib/knowledge/types";

/**
 * Search infrastructure for the RAG pipeline.
 *
 * Implements hybrid retrieval:
 *   1. Vector similarity search over chunk embeddings (cosine similarity).
 *   2. Keyword search as a fallback when embeddings are unavailable or the
 *      query embedding fails to generate.
 *
 * Phase 9 adds rich filtering:
 *   - category / categories
 *   - state
 *   - language
 *   - ministry
 *   - tags
 *   - published date range
 *
 * Every retrieval also records a SearchEvent for analytics.
 */

/** A single retrieved chunk with enough context for an LLM prompt. */
export interface RetrievedChunk {
  /** Chunk row id. */
  chunkId: string;
  /** Content of the chunk. */
  content: string;
  /** Position of the chunk in its source document. */
  chunkIndex: number;
  /** Source document title. */
  documentTitle: string;
  /** Source document category. */
  category: string;
  /** Source attribution (e.g. "Ministry of Agriculture"). */
  source: string;
  /** Filesystem path of the source markdown file (null when not tracked). */
  sourcePath: string | null;
  /** Canonical source URL (Phase 9 citation). */
  sourceUrl: string | null;
  /** Heading under which the chunk appears (Phase 9 citation). */
  heading: string | null;
  /** Heading hierarchy path (Phase 9). */
  headingPath: string[];
  /** True when the chunk contains table content. */
  hasTable: boolean;
  /** Relevance score from the retriever. */
  score: number;
}

/** Options controlling retrieval breadth. */
export interface RetrieveOptions extends SearchFilters {
  /** Maximum number of chunks to return. Defaults to 4. */
  topK?: number;
}

/** Result of a retrieval call. */
export interface RetrieveResult {
  chunks: RetrievedChunk[];
  /** True when the retriever used embeddings; false when keyword fallback. */
  usedEmbeddings: boolean;
  /** Retrieval latency in milliseconds. */
  latencyMs: number;
}

/**
 * Computes cosine similarity between two vectors.
 * Returns 0 when either vector is empty or lengths differ.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Builds the Prisma where clause from rich search filters. */
function buildDocumentWhere(filters: SearchFilters): Prisma.KnowledgeDocumentWhereInput {
  const where: Prisma.KnowledgeDocumentWhereInput = {};

  if (filters.category) {
    where.category = filters.category;
  } else if (filters.categories && filters.categories.length > 0) {
    where.category = { in: filters.categories };
  }

  if (filters.state) {
    where.state = filters.state;
  }

  if (filters.language) {
    where.language = filters.language;
  }

  if (filters.ministry) {
    where.ministry = filters.ministry;
  }

  if (filters.tags && filters.tags.length > 0) {
    where.tags = { hasSome: filters.tags };
  }

  if (filters.publishedAfter || filters.publishedBefore) {
    where.publishedAt = {};
    if (filters.publishedAfter) {
      where.publishedAt.gte = filters.publishedAfter;
    }
    if (filters.publishedBefore) {
      where.publishedAt.lte = filters.publishedBefore;
    }
  }

  return where;
}

/**
 * Performs vector similarity search over chunk embeddings.
 *
 * Fetches all chunks with non-null embeddings (optionally scoped by filters),
 * computes cosine similarity against the query embedding, and returns the
 * top-K most similar chunks sorted by score descending.
 */
export async function findChunksByVector(
  queryEmbedding: number[],
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { topK = 4 } = options;
  const documentWhere = buildDocumentWhere(options);

  const where: Prisma.KnowledgeChunkWhereInput = {
    embedding: { not: Prisma.DbNull },
    ...(Object.keys(documentWhere).length > 0 ? { document: documentWhere } : {}),
  };

  const rows = await prisma.knowledgeChunk.findMany({
    where,
    select: {
      id: true,
      content: true,
      chunkIndex: true,
      heading: true,
      headingPath: true,
      hasTable: true,
      embedding: true,
      document: {
        select: {
          title: true,
          category: true,
          source: true,
          sourcePath: true,
          sourceUrl: true,
        },
      },
    },
  });

  const scored = rows
    .map((row) => {
      const embedding = row.embedding;
      // Prisma returns JsonValue; guard against non-array values.
      const vector = Array.isArray(embedding)
        ? (embedding as number[]).filter((v) => typeof v === "number")
        : [];
      return {
        row,
        score: cosineSimilarity(queryEmbedding, vector),
      };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.map(({ row, score }) => ({
    chunkId: row.id,
    content: row.content,
    chunkIndex: row.chunkIndex,
    documentTitle: row.document.title,
    category: row.document.category,
    source: row.document.source,
    sourcePath: row.document.sourcePath,
    sourceUrl: row.document.sourceUrl,
    heading: row.heading,
    headingPath: row.headingPath,
    hasTable: row.hasTable,
    score,
  }));
}

/**
 * Reads chunks by keyword search over content (fallback when embeddings are
 * unavailable). Matches chunks whose content contains any of the query terms.
 */
export async function findChunksByKeyword(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { topK = 4 } = options;
  const documentWhere = buildDocumentWhere(options);

  // Extract meaningful terms (3+ chars, alphanumeric) from the query.
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);

  const where: Prisma.KnowledgeChunkWhereInput = {
    ...(Object.keys(documentWhere).length > 0 ? { document: documentWhere } : {}),
    ...(terms.length > 0
      ? {
          OR: terms.map((term) => ({
            content: { contains: term, mode: "insensitive" as const },
          })),
        }
      : {}),
  };

  const rows = await prisma.knowledgeChunk.findMany({
    where,
    select: {
      id: true,
      content: true,
      chunkIndex: true,
      heading: true,
      headingPath: true,
      hasTable: true,
      document: {
        select: {
          title: true,
          category: true,
          source: true,
          sourcePath: true,
          sourceUrl: true,
        },
      },
    },
    take: topK,
    orderBy: { createdAt: "desc" },
  });

  return rows.map((row) => ({
    chunkId: row.id,
    content: row.content,
    chunkIndex: row.chunkIndex,
    documentTitle: row.document.title,
    category: row.document.category,
    source: row.document.source,
    sourcePath: row.document.sourcePath,
    sourceUrl: row.document.sourceUrl,
    heading: row.heading,
    headingPath: row.headingPath,
    hasTable: row.hasTable,
    score: 0,
  }));
}

/**
 * Retrieves the most relevant chunks for a query using hybrid search.
 *
 * 1. Generates a query embedding via the active provider.
 * 2. If the embedding is available, performs vector similarity search.
 * 3. Falls back to keyword search when the embedding is null or the vector
 *    search returns no results.
 * 4. Records a SearchEvent for analytics.
 */
export async function retrieveChunks(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  const { topK = 4 } = options;
  const started = performance.now();

  try {
    const provider = getEmbeddingProvider();
    const queryEmbedding = await provider.generateEmbedding(query);

    let chunks: RetrievedChunk[] = [];
    let usedEmbeddings = false;

    if (queryEmbedding) {
      chunks = await findChunksByVector(queryEmbedding, options);
      if (chunks.length > 0) {
        usedEmbeddings = true;
      }
    }

    if (chunks.length === 0) {
      chunks = await findChunksByKeyword(query, options);
    }

    const latencyMs = Math.round(performance.now() - started);

    // Record analytics event (non-fatal on failure).
    await recordSearchEvent({
      query,
      filters: options,
      resultCount: chunks.length,
      usedEmbeddings,
      latencyMs,
      success: true,
    }).catch(() => undefined);

    return { chunks, usedEmbeddings, latencyMs };
  } catch (error) {
    logError("Knowledge search failed", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });

    const latencyMs = Math.round(performance.now() - started);
    await recordSearchEvent({
      query,
      filters: options,
      resultCount: 0,
      usedEmbeddings: false,
      latencyMs,
      success: false,
    }).catch(() => undefined);

    return { chunks: [], usedEmbeddings: false, latencyMs };
  }
}

/** Records a search event for analytics (Phase 9). */
async function recordSearchEvent(input: {
  query: string;
  filters: SearchFilters;
  resultCount: number;
  usedEmbeddings: boolean;
  latencyMs: number;
  success: boolean;
}): Promise<void> {
  await prisma.searchEvent.create({
    data: {
      query: input.query.slice(0, 500),
      filters: input.filters as Prisma.InputJsonValue,
      resultCount: input.resultCount,
      usedEmbeddings: input.usedEmbeddings,
      latencyMs: input.latencyMs,
      success: input.success,
    },
  });
}

/** Formats retrieved chunks into a compact prompt-ready text block with citations. */
export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      const citation = [
        `[${index + 1}] Source: ${chunk.source} | ${chunk.documentTitle} (${chunk.category})`,
        chunk.heading ? `Heading: ${chunk.heading}` : null,
        chunk.sourceUrl ? `URL: ${chunk.sourceUrl}` : null,
        `Chunk #${chunk.chunkIndex}`,
        `Confidence: ${(chunk.score * 100).toFixed(1)}%`,
      ]
        .filter(Boolean)
        .join("\n");
      return `${citation}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}