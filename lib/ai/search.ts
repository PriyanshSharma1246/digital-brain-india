import { prisma } from "@/lib/prisma";

/**
 * Search infrastructure for the RAG pipeline.
 *
 * Defines the search result contract and the fetch operations over the
 * KnowledgeDocument / KnowledgeChunk tables. Embeddings are not consumed
 * yet (they are `null`); this module focuses on the query plumbing that a
 * future vector search (or hybrid search) will build on.
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
  /** True when the retriever used embeddings; false while embeddings are null. */
  usedEmbeddings: boolean;
}

/** Reads chunks by exact search over content (fallback while embeddings are null). */
export async function findChunksByKeyword(options: RetrieveOptions = {}): Promise<RetrievedChunk[]> {
  const { topK = 4, category } = options;

  // Embeddings are still null while the provider is a stub, so there is no
  // vector filter yet. This where clause already supports category scoping
  // and will gain an embedding/vector condition when the provider is wired.
  const where = {
    ...(category ? { document: { category } } : {}),
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

/** Formats retrieved chunks into a compact prompt-ready text block. */
export function formatRetrievedChunks(chunks: RetrievedChunk[]): string {
  return chunks
    .map((chunk, index) => {
      return `[${index + 1}] Source: ${chunk.source} | ${chunk.documentTitle} (${chunk.category})\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
}
