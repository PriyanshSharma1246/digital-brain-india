import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "./embeddings";
import { logError } from "@/lib/logger";

/**
 * Search infrastructure for the RAG pipeline.
 *
 * Implements hybrid retrieval:
 *   1. Vector similarity search over chunk embeddings (cosine similarity).
 *   2. Keyword search as a fallback when embeddings are unavailable or the
 *      query embedding fails to generate.
 *
 * The vector path fetches all chunks with non-null embeddings, computes cosine
 * similarity in memory, and returns the top-K. This is appropriate for the
 * current corpus size; a dedicated vector index (pgvector) can be added later
 * without changing the public API.
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
  /** Relevance score from the retriever. */
  score: number;
}

/** Options controlling retrieval breadth. */
export interface RetrieveOptions {
  /** Maximum number of chunks to return. Defaults to 4. */
  topK?: number;
  /** Restrict retrieval to a single category when provided. */
  category?: string;
}

/** Result of a retrieval call. */
export interface RetrieveResult {
  chunks: RetrievedChunk[];
  /** True when the retriever used embeddings; false when keyword fallback. */
  usedEmbeddings: boolean;
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

/**
 * Performs vector similarity search over chunk embeddings.
 *
 * Fetches all chunks with non-null embeddings (optionally scoped by category),
 * computes cosine similarity against the query embedding, and returns the
 * top-K most similar chunks sorted by score descending.
 */
export async function findChunksByVector(
  queryEmbedding: number[],
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const { topK = 4, category } = options;

  const where = {
    embedding: { not: Prisma.DbNull },
    ...(category ? { document: { category } } : {}),
  };

  const rows = await prisma.knowledgeChunk.findMany({
    where,
    select: {
      id: true,
      content: true,
      chunkIndex: true,
      embedding: true,
      document: {
        select: {
          title: true,
          category: true,
          source: true,
          sourcePath: true,
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
  const { topK = 4, category } = options;

  // Extract meaningful terms (3+ chars, alphanumeric) from the query.
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length >= 3);

  const where = {
    ...(category ? { document: { category } } : {}),
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
      document: {
        select: {
          title: true,
          category: true,
          source: true,
          sourcePath: true,
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
 */
export async function retrieveChunks(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  const { topK = 4, category } = options;

  try {
    const provider = getEmbeddingProvider();
    const queryEmbedding = await provider.generateEmbedding(query);

    if (queryEmbedding) {
      const chunks = await findChunksByVector(queryEmbedding, { topK, category });
      if (chunks.length > 0) {
        return { chunks, usedEmbeddings: true };
      }
      // Vector search returned nothing — fall through to keyword.
    }

    const chunks = await findChunksByKeyword(query, { topK, category });
    return { chunks, usedEmbeddings: false };
  } catch (error) {
    logError("Knowledge search failed", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    return { chunks: [], usedEmbeddings: false };
  }
}

/** Formats retrieved chunks into a compact prompt-ready text block. */
export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      return `[${index + 1}] Source: ${chunk.source} | ${chunk.documentTitle} (${chunk.category})\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}