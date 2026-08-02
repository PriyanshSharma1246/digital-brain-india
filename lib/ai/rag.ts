import { loadMarkdownFromDirectory } from "@/lib/knowledge/loader";
import { splitDocument as splitDocumentIntoChunks } from "@/lib/knowledge/splitter";
import { ingestDirectory, ingestFile } from "@/lib/knowledge/ingest";
import { embedText } from "./embeddings";
import {
  findChunksByKeyword,
  formatRetrievedChunks,
  type RetrievedChunk,
  type RetrieveOptions,
  type RetrieveResult,
} from "./search";
import type { Chunk, ParsedMarkdown } from "@/lib/knowledge/types";
import { logError } from "@/lib/logger";

/**
 * RAG orchestration layer.
 *
 * This module exposes the high-level pipeline used by the rest of the app:
 *
 *   loadKnowledge()          -> scan + parse the markdown corpus
 *   splitDocument()          -> chunk a parsed document
 *   storeChunks()            -> persist document + chunks (dedupe-aware)
 *   searchKnowledge()        -> retrieve relevant chunks for a query
 *   retrieveRelevantChunks() -> alias used by the chat pipeline
 *
 * Embeddings are intentionally NOT computed yet (Task 6). The embedding
 * provider is a stub that returns null; search falls back to keyword
 * retrieval until the vector backend is wired in a later phase.
 */

/** Loads and parses every markdown file in the knowledge corpus. */
export async function loadKnowledge(rootDir: string): Promise<ParsedMarkdown[]> {
  return loadMarkdownFromDirectory(rootDir);
}

/** Splits a parsed document into bounded, paragraph-preserving chunks. */
export function splitDocument(document: ParsedMarkdown): Chunk[] {
  return splitDocumentIntoChunks(document.content);
}

/**
 * Persists a parsed document and its chunks, avoiding duplicate imports.
 * Returns a summary of what happened (created/updated/skipped/failed).
 */
export async function storeChunks(document: ParsedMarkdown): Promise<{
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  // The ingestion service owns the dedupe + transaction logic. We delegate
  // to it so the RAG layer stays a thin orchestrator.
  return ingestFile(document.path);
}

/**
 * Retrieves the most relevant chunks for a query.
 *
 * While embeddings are null this performs keyword retrieval; once the
 * embedding provider is wired, this will switch to vector similarity.
 */
export async function searchKnowledge(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  const { topK = 4, category } = options;

  try {
    // Placeholder: embed the query (returns null for now) and fall back to
    // keyword search. The vector path will be added when embeddings exist.
    const queryEmbedding = await embedText(query);
    const usedEmbeddings = queryEmbedding !== null;

    const chunks = await findChunksByKeyword({ topK, category });
    return { chunks, usedEmbeddings };
  } catch (error) {
    logError("Knowledge search failed", {
      query,
      error: error instanceof Error ? error.message : String(error),
    });
    return { chunks: [], usedEmbeddings: false };
  }
}

/** Convenience alias used by the chat pipeline to build prompt context. */
export async function retrieveRelevantChunks(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrievedChunk[]> {
  const result = await searchKnowledge(query, options);
  return result.chunks;
}

/** Formats retrieved chunks into a prompt-ready text block. */
export function buildKnowledgeContext(chunks: RetrievedChunk[]): string {
  return formatRetrievedChunks(chunks);
}

/** Ingests the whole corpus directory (used by scripts / admin tooling). */
export async function ingestCorpus(rootDir: string) {
  return ingestDirectory(rootDir);
}