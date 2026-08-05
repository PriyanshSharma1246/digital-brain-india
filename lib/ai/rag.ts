import { loadKnowledgeFromDirectory } from "@/lib/knowledge/loader";
import { splitDocument as splitDocumentIntoChunks } from "@/lib/knowledge/splitter";
import { ingestDirectory, ingestFile } from "@/lib/knowledge/ingest";
import {
  formatRetrievedChunks,
  retrieveChunks,
  type RetrievedChunk,
  type RetrieveOptions,
  type RetrieveResult,
} from "./search";
import type { Chunk, ParsedDocument } from "@/lib/knowledge/types";

/**
 * RAG orchestration layer.
 *
 * This module exposes the high-level pipeline used by the rest of the app:
 *
 *   loadKnowledge()          -> scan + parse the knowledge corpus
 *   splitDocument()          -> chunk a parsed document
 *   storeChunks()            -> persist document + chunks (dedupe-aware)
 *   searchKnowledge()        -> retrieve relevant chunks for a query
 *   retrieveRelevantChunks() -> alias used by the chat pipeline
 *
 * Search uses hybrid retrieval: vector similarity when embeddings are
 * available, keyword fallback otherwise (see lib/ai/search.ts).
 */

/** Loads and parses every supported file in the knowledge corpus. */
export async function loadKnowledge(rootDir: string): Promise<ParsedDocument[]> {
  return loadKnowledgeFromDirectory(rootDir);
}

/** Splits a parsed document into bounded, paragraph-preserving chunks. */
export function splitDocument(document: ParsedDocument): Chunk[] {
  return splitDocumentIntoChunks(document.content);
}

/**
 * Persists a parsed document and its chunks, avoiding duplicate imports.
 * Returns a summary of what happened (created/updated/skipped/failed).
 */
export async function storeChunks(document: ParsedDocument): Promise<{
  created: number;
  updated: number;
  skipped: number;
  failed: number;
}> {
  // The ingestion service owns the dedupe + transaction logic. We delegate
  // to it so the RAG layer stays a thin orchestrator.
  if (!document.path) {
    return { created: 0, updated: 0, skipped: 0, failed: 1 };
  }
  return ingestFile(document.path);
}

/**
 * Retrieves the most relevant chunks for a query using hybrid search.
 *
 * Uses vector similarity when embeddings are available; falls back to
 * keyword search when the embedding provider is unavailable or the vector
 * path returns no results.
 */
export async function searchKnowledge(
  query: string,
  options: RetrieveOptions = {}
): Promise<RetrieveResult> {
  return retrieveChunks(query, options);
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