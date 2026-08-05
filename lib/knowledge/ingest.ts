import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loadKnowledgeFile, loadKnowledgeFromDirectory } from "./loader";
import { splitDocument } from "./splitter";
import type { ChunkedDocument, ParsedDocument } from "./types";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { logError, logEvent } from "@/lib/logger";

/**
 * Ingestion service.
 *
 * Pipeline:
 *   Source file -> Loader (parse + metadata) -> Splitter (chunks)
 *   -> Embeddings (Gemini) -> Prisma (KnowledgeDocument + KnowledgeChunk rows)
 *
 * Duplicate avoidance (Phase 9):
 *   - `sourcePath` is unique in the DB. If a document with the same path
 *     already exists AND its checksum matches, it is skipped.
 *   - If the checksum differs, the document and its chunks are replaced
 *     (re-ingested) and a DocumentVersion snapshot is created.
 *   - `checksum` is unique, enabling cross-path duplicate detection.
 *
 * Embeddings:
 *   - Chunks are embedded in batches using the active EmbeddingProvider.
 *   - If the provider is unavailable (no API key) or a batch fails, the
 *     affected chunks are stored with `embedding = null` and keyword search
 *     remains the fallback.
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

/** Ingests every supported file under a directory (recursively). */
export async function ingestDirectory(rootDir: string): Promise<IngestResult> {
  const documents = await loadKnowledgeFromDirectory(rootDir);
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

/** Ingests a single file. */
export async function ingestFile(filePath: string): Promise<IngestResult> {
  const document = await loadKnowledgeFile(filePath);
  if (!document) {
    return { created: 0, updated: 0, skipped: 0, failed: 1 };
  }

  const outcome = await ingestParsedDocument(document);
  const result: IngestResult = { created: 0, updated: 0, skipped: 0, failed: 0 };
  result[outcome] += 1;
  return result;
}

/** Ingests an in-memory parsed document (used by the upload pipeline). */
export async function ingestParsedDocument(
  parsed: ParsedDocument
): Promise<"created" | "updated" | "skipped" | "failed"> {
  const checksum = hashContent(parsed.rawContent);
  const sourcePath = parsed.path;

  try {
    // 1. Check for an existing document by source path (legacy dedupe).
    const existing = await prisma.knowledgeDocument.findUnique({
      where: { sourcePath: sourcePath ?? undefined },
      select: { id: true, checksum: true, contentHash: true },
    });

    if (existing) {
      if (existing.checksum === checksum || existing.contentHash === checksum) {
        return "skipped";
      }
      await replaceDocument(existing.id, parsed, checksum);
      return "updated";
    }

    // 2. Check for a duplicate by checksum (cross-path duplicate detection).
    const duplicate = await prisma.knowledgeDocument.findUnique({
      where: { checksum },
      select: { id: true, title: true },
    });

    if (duplicate) {
      logEvent("warn", "Duplicate document detected by checksum", {
        existingId: duplicate.id,
        existingTitle: duplicate.title,
        incomingPath: sourcePath,
        incomingTitle: parsed.metadata.title,
      });
      return "skipped";
    }

    await createDocument(parsed, checksum);
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
async function createDocument(parsed: ParsedDocument, checksum: string): Promise<void> {
  const chunked = toChunkedDocument(parsed, checksum);
  const embeddings = await embedChunks(chunked.chunks.map((c) => c.content));

  await prisma.$transaction(async (tx) => {
    const document = await tx.knowledgeDocument.create({
      data: {
        title: chunked.document.title,
        description: chunked.document.description,
        category: chunked.document.category,
        subcategory: chunked.document.subcategory,
        state: chunked.document.state,
        ministry: chunked.document.ministry,
        language: chunked.document.language,
        source: chunked.document.source,
        sourceUrl: chunked.document.sourceUrl,
        publishedAt: chunked.document.publishedAt,
        tags: chunked.document.tags,
        version: chunked.document.version,
        checksum: chunked.document.checksum,
        content: chunked.document.content,
        contentType: chunked.document.contentType,
        sourcePath: chunked.document.sourcePath,
        contentHash: chunked.document.checksum,
        ingestedAt: new Date(),
      },
    });

    await tx.knowledgeChunk.createMany({
      data: chunked.chunks.map((chunk, index) => ({
        documentId: document.id,
        content: chunk.content,
        chunkIndex: chunk.index,
        headingPath: chunk.headingPath,
        heading: chunk.heading,
        hasTable: chunk.hasTable,
        embedding: embeddings[index] ?? Prisma.DbNull,
      })),
    });

    // Create the initial version snapshot.
    await tx.documentVersion.create({
      data: {
        documentId: document.id,
        version: chunked.document.version ?? "1.0.0",
        checksum,
        content: chunked.document.content,
        metadata: {
          title: chunked.document.title,
          description: chunked.document.description,
          category: chunked.document.category,
          subcategory: chunked.document.subcategory,
          state: chunked.document.state,
          ministry: chunked.document.ministry,
          language: chunked.document.language,
          source: chunked.document.source,
          sourceUrl: chunked.document.sourceUrl,
          publishedAt: chunked.document.publishedAt,
          tags: chunked.document.tags,
          version: chunked.document.version,
        },
      },
    });
  });
}

/** Replaces a document's content and chunks when the source changed. */
async function replaceDocument(
  documentId: string,
  parsed: ParsedDocument,
  checksum: string
): Promise<void> {
  const chunked = toChunkedDocument(parsed, checksum);
  const embeddings = await embedChunks(chunked.chunks.map((c) => c.content));

  await prisma.$transaction(async (tx) => {
    await tx.knowledgeDocument.update({
      where: { id: documentId },
      data: {
        title: chunked.document.title,
        description: chunked.document.description,
        category: chunked.document.category,
        subcategory: chunked.document.subcategory,
        state: chunked.document.state,
        ministry: chunked.document.ministry,
        language: chunked.document.language,
        source: chunked.document.source,
        sourceUrl: chunked.document.sourceUrl,
        publishedAt: chunked.document.publishedAt,
        tags: chunked.document.tags,
        version: chunked.document.version,
        checksum: chunked.document.checksum,
        content: chunked.document.content,
        contentType: chunked.document.contentType,
        contentHash: chunked.document.checksum,
        ingestedAt: new Date(),
      },
    });

    // Remove old chunks (cascade-safe) and insert fresh ones.
    await tx.knowledgeChunk.deleteMany({ where: { documentId } });
    await tx.knowledgeChunk.createMany({
      data: chunked.chunks.map((chunk, index) => ({
        documentId,
        content: chunk.content,
        chunkIndex: chunk.index,
        headingPath: chunk.headingPath,
        heading: chunk.heading,
        hasTable: chunk.hasTable,
        embedding: embeddings[index] ?? Prisma.DbNull,
      })),
    });

    // Create a version snapshot for the updated content.
    await tx.documentVersion.create({
      data: {
        documentId,
        version: chunked.document.version ?? `v-${Date.now()}`,
        checksum,
        content: chunked.document.content,
        metadata: {
          title: chunked.document.title,
          description: chunked.document.description,
          category: chunked.document.category,
          subcategory: chunked.document.subcategory,
          state: chunked.document.state,
          ministry: chunked.document.ministry,
          language: chunked.document.language,
          source: chunked.document.source,
          sourceUrl: chunked.document.sourceUrl,
          publishedAt: chunked.document.publishedAt,
          tags: chunked.document.tags,
          version: chunked.document.version,
        },
      },
    });
  });
}

/**
 * Generates embeddings for a list of chunk texts using the active provider.
 *
 * Returns an array aligned with `texts`; entries are `null` when the provider
 * is unavailable or a batch fails. The caller stores nulls so keyword search
 * remains the fallback.
 */
async function embedChunks(texts: string[]): Promise<(number[] | null)[]> {
  const provider = getEmbeddingProvider();
  if (!provider.isAvailable()) {
    return texts.map(() => null);
  }
  return provider.embedBatch(texts);
}

/** Builds the ChunkedDocument shape from a parsed document. */
function toChunkedDocument(parsed: ParsedDocument, checksum: string): ChunkedDocument {
  const chunks = splitDocument(parsed.content);
  return {
    document: {
      title: parsed.metadata.title,
      description: parsed.metadata.description ?? null,
      category: parsed.metadata.category,
      subcategory: parsed.metadata.subcategory ?? null,
      state: parsed.metadata.state ?? null,
      ministry: parsed.metadata.ministry ?? null,
      language: parsed.metadata.language,
      source: parsed.metadata.source,
      sourceUrl: parsed.metadata.sourceUrl ?? null,
      publishedAt: parsed.metadata.publishedAt ?? null,
      tags: parsed.metadata.tags,
      version: parsed.metadata.version ?? null,
      checksum,
      content: parsed.content,
      contentType: parsed.contentType,
      sourcePath: parsed.path,
      contentHash: checksum,
    },
    chunks,
  };
}

/** Deterministic SHA-256 hash of the raw file content. */
export function hashContent(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}