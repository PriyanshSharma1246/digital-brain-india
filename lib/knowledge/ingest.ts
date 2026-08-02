import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { loadMarkdownFile, loadMarkdownFromDirectory } from "./loader";
import { splitDocument } from "./splitter";
import type { ChunkedDocument, ParsedMarkdown } from "./types";
import { logError, logEvent } from "@/lib/logger";

/**
 * Ingestion service.
 *
 * Pipeline:
 *   Markdown file -> Loader (parse + metadata) -> Splitter (chunks)
 *   -> Prisma (KnowledgeDocument + KnowledgeChunk rows)
 *
 * Duplicate avoidance:
 *   - `sourcePath` is unique in the DB. If a document with the same path
 *     already exists AND its content hash matches, it is skipped.
 *   - If the content hash differs, the document and its chunks are replaced
 *     (re-ingested) so the corpus stays in sync with the source files.
 *
 * Embeddings are stored as `null` for now; the embedding provider is wired
 * up in a later phase (see lib/ai/embeddings.ts).
 */

export interface IngestResult {
  /** Documents created in this run. */
  created: number;
  /** Documents updated (content changed) in this run. */
  updated: number;
  /** Documents skipped because they were unchanged. */
  skipped: number;
  /** Documents that failed to load or persist. */
  failed: number;
}

/** Ingests every markdown file under a directory (recursively). */
export async function ingestDirectory(rootDir: string): Promise<IngestResult> {
  const documents = await loadMarkdownFromDirectory(rootDir);
  const result: IngestResult = { created: 0, updated: 0, skipped: 0, failed: 0 };

  for (const document of documents) {
    const outcome = await ingestParsedDocument(document);
    result[outcome] += 1;
  }

  logEvent("info", "Knowledge directory ingestion complete", {
    rootDir,
    total: documents.length,
    ...result,
  });
  return result;
}

/** Ingests a single markdown file. */
export async function ingestFile(filePath: string): Promise<IngestResult> {
  const document = await loadMarkdownFile(filePath);
  if (!document) {
    return { created: 0, updated: 0, skipped: 0, failed: 1 };
  }

  const outcome = await ingestParsedDocument(document);
  const result: IngestResult = { created: 0, updated: 0, skipped: 0, failed: 0 };
  result[outcome] += 1;
  return result;
}

/** Persists a parsed document and its chunks, avoiding duplicate imports. */
async function ingestParsedDocument(
  parsed: ParsedMarkdown
): Promise<"created" | "updated" | "skipped" | "failed"> {
  const contentHash = hashContent(parsed.rawContent);
  const sourcePath = parsed.path;

  try {
    const existing = await prisma.knowledgeDocument.findUnique({
      where: { sourcePath },
      select: { id: true, contentHash: true },
    });

    if (existing) {
      if (existing.contentHash === contentHash) {
        return "skipped";
      }
      await replaceDocument(existing.id, parsed, contentHash);
      return "updated";
    }

    await createDocument(parsed, contentHash);
    return "created";
  } catch (error) {
    logError("Knowledge document ingestion failed", {
      path: sourcePath,
      title: parsed.metadata.title,
      error: error instanceof Error ? error.message : String(error),
    });
    return "failed";
  }
}

/** Creates a new KnowledgeDocument plus its chunks in a single transaction. */
async function createDocument(parsed: ParsedMarkdown, contentHash: string): Promise<void> {
  const chunked = toChunkedDocument(parsed, contentHash);

  await prisma.$transaction(async (tx) => {
    const document = await tx.knowledgeDocument.create({
      data: {
        title: chunked.document.title,
        category: chunked.document.category,
        source: chunked.document.source,
        content: chunked.document.content,
        sourcePath: chunked.document.sourcePath,
        contentHash: chunked.document.contentHash,
      },
    });

    // `embedding` is omitted so it defaults to SQL NULL (embeddings are
    // computed in a later phase).
    await tx.knowledgeChunk.createMany({
      data: chunked.chunks.map((chunk) => ({
        documentId: document.id,
        content: chunk.content,
        chunkIndex: chunk.index,
      })),
    });
  });
}

/** Replaces a document's content and chunks when the source changed. */
async function replaceDocument(
  documentId: string,
  parsed: ParsedMarkdown,
  contentHash: string
): Promise<void> {
  const chunked = toChunkedDocument(parsed, contentHash);

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        title: chunked.document.title,
        category: chunked.document.category,
        source: chunked.document.source,
        content: chunked.document.content,
        contentHash: chunked.document.contentHash,
      },
    });

    // Remove old chunks (cascade-safe) and insert fresh ones.
    await tx.knowledgeChunk.deleteMany({ where: { documentId } });
    // `embedding` is omitted so it defaults to SQL NULL (embeddings are
    // computed in a later phase).
    await tx.knowledgeChunk.createMany({
      data: chunked.chunks.map((chunk) => ({
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
      })),
    });
  });
}

/** Builds the ChunkedDocument shape from a parsed markdown file. */
function toChunkedDocument(parsed: ParsedMarkdown, contentHash: string): ChunkedDocument {
  const chunks = splitDocument(parsed.content);
  return {
    document: {
      title: parsed.metadata.title,
      category: parsed.metadata.category,
      source: parsed.metadata.source,
      content: parsed.content,
      sourcePath: parsed.path,
      contentHash,
    },
    chunks,
  };
}

/** Deterministic SHA-256 hash of the raw file content. */
function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}