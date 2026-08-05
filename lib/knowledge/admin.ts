import path from "node:path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ingestDirectory } from "./ingest";
import { getEmbeddingProvider } from "@/lib/ai/embeddings";
import { logError, logEvent } from "@/lib/logger";
import { getAnalyticsDashboard } from "./analytics";
import { getQualitySummary } from "./quality";

/**
 * Admin service for the Knowledge Management Dashboard.
 *
 * These functions power the /admin/knowledge route and its API endpoints.
 * They intentionally reuse the existing ingestion pipeline (lib/knowledge/ingest)
 * rather than duplicating any parsing/splitting/persistence logic.
 *
 * Phase 9 extends the dashboard with:
 *   - Full metadata (description, subcategory, state, ministry, language,
 *     source URL, published date, tags, version, checksum)
 *   - Document version history
 *   - Analytics (search, latency, embedding coverage, category distribution)
 *   - Quality check summary
 */

/** Absolute path of the markdown corpus directory. */
export const KNOWLEDGE_CORPUS_DIR = path.join(process.cwd(), "knowledge");

/** A document row with its chunk count, as shown in the dashboard table. */
export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  state: string | null;
  ministry: string | null;
  language: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  tags: string[];
  version: string | null;
  checksum: string | null;
  contentType: string;
  sourcePath: string | null;
  contentHash: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
  ingestedAt: Date;
}

/** Dashboard aggregate stats. */
export interface KnowledgeDashboardStats {
  totalDocuments: number;
  totalChunks: number;
  lastIngestionAt: Date | null;
}

/** A single chunk with its order and length, shown in the detail view. */
export interface KnowledgeChunkDetail {
  id: string;
  chunkIndex: number;
  content: string;
  heading: string | null;
  headingPath: string[];
  hasTable: boolean;
  length: number;
  createdAt: Date;
}

/** A document version snapshot. */
export interface DocumentVersionDetail {
  id: string;
  version: string;
  checksum: string;
  createdAt: Date;
}

/** Full document detail including metadata, markdown body and chunks. */
export interface KnowledgeDocumentDetail {
  id: string;
  title: string;
  description: string | null;
  category: string;
  subcategory: string | null;
  state: string | null;
  ministry: string | null;
  language: string;
  source: string;
  sourceUrl: string | null;
  publishedAt: Date | null;
  tags: string[];
  version: string | null;
  checksum: string | null;
  contentType: string;
  content: string;
  sourcePath: string | null;
  contentHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  ingestedAt: Date;
  chunks: KnowledgeChunkDetail[];
  versions: DocumentVersionDetail[];
}

/**
 * Lists documents with their chunk counts, optionally filtered by
 * title / category / source path.
 */
export async function listKnowledgeDocuments(search = ""): Promise<KnowledgeDocumentSummary[]> {
  const where = search.trim()
    ? {
        OR: [
          { title: { contains: search.trim(), mode: "insensitive" as const } },
          { category: { contains: search.trim(), mode: "insensitive" as const } },
          { sourcePath: { contains: search.trim(), mode: "insensitive" as const } },
          { ministry: { contains: search.trim(), mode: "insensitive" as const } },
          { state: { contains: search.trim(), mode: "insensitive" as const } },
        ],
      }
    : {};

  const documents = await prisma.knowledgeDocument.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { chunks: true } },
    },
  });

  return documents.map((doc) => ({
    id: doc.id,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    subcategory: doc.subcategory,
    state: doc.state,
    ministry: doc.ministry,
    language: doc.language,
    source: doc.source,
    sourceUrl: doc.sourceUrl,
    publishedAt: doc.publishedAt,
    tags: doc.tags,
    version: doc.version,
    checksum: doc.checksum,
    contentType: doc.contentType,
    sourcePath: doc.sourcePath,
    contentHash: doc.contentHash,
    chunkCount: doc._count.chunks,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ingestedAt: doc.ingestedAt,
  }));
}

/** Returns dashboard aggregate stats (totals + last ingestion time). */
export async function getKnowledgeDashboardStats(): Promise<KnowledgeDashboardStats> {
  const [totalDocuments, totalChunks, lastDocument] = await Promise.all([
    prisma.knowledgeDocument.count(),
    prisma.knowledgeChunk.count(),
    prisma.knowledgeDocument.findFirst({
      orderBy: { updatedAt: "desc" },
      select: { updatedAt: true },
    }),
  ]);

  return {
    totalDocuments,
    totalChunks,
    lastIngestionAt: lastDocument?.updatedAt ?? null,
  };
}

/** Fetches a single document with its ordered chunks and version history. */
export async function getKnowledgeDocumentDetail(id: string): Promise<KnowledgeDocumentDetail | null> {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
      },
      versions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!document) return null;

  return {
    id: document.id,
    title: document.title,
    description: document.description,
    category: document.category,
    subcategory: document.subcategory,
    state: document.state,
    ministry: document.ministry,
    language: document.language,
    source: document.source,
    sourceUrl: document.sourceUrl,
    publishedAt: document.publishedAt,
    tags: document.tags,
    version: document.version,
    checksum: document.checksum,
    contentType: document.contentType,
    content: document.content,
    sourcePath: document.sourcePath,
    contentHash: document.contentHash,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    ingestedAt: document.ingestedAt,
    chunks: document.chunks.map((chunk) => ({
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      heading: chunk.heading,
      headingPath: chunk.headingPath,
      hasTable: chunk.hasTable,
      length: chunk.content.length,
      createdAt: chunk.createdAt,
    })),
    versions: document.versions.map((version) => ({
      id: version.id,
      version: version.version,
      checksum: version.checksum,
      createdAt: version.createdAt,
    })),
  };
}

/**
 * Deletes a document and its chunks safely.
 *
 * The KnowledgeChunk.document relation is configured with `onDelete: Cascade`,
 * so deleting the parent document removes all associated chunks in one
 * transaction. We still wrap it in an explicit transaction for clarity and
 * to guarantee atomicity.
 */
export async function deleteKnowledgeDocument(id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.knowledgeChunk.deleteMany({ where: { documentId: id } });
    await tx.documentVersion.deleteMany({ where: { documentId: id } });
    await tx.qualityCheckResult.deleteMany({ where: { documentId: id } });
    await tx.knowledgeDocument.delete({ where: { id } });
  });
}

/**
 * Re-ingests the entire markdown corpus using the existing ingestion pipeline.
 *
 * The pipeline is idempotent: unchanged documents are skipped, changed ones
 * are replaced, and new ones are created. Returns the same IngestResult shape
 * produced by lib/knowledge/ingest.
 */
export async function reIngestKnowledgeBase() {
  return ingestDirectory(KNOWLEDGE_CORPUS_DIR);
}

/** Convenience wrapper that logs and rethrows for API error handling. */
export async function safeReIngestKnowledgeBase() {
  try {
    return await reIngestKnowledgeBase();
  } catch (error) {
    logError("Knowledge re-ingestion failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Re-indexes existing documents that have chunks without embeddings.
 *
 * Finds all chunks where `embedding` is NULL, generates embeddings for them
 * using the active provider, and updates the rows. Returns the number of
 * chunks re-indexed. When the provider is unavailable, returns 0.
 */
export async function reIndexMissingEmbeddings(): Promise<number> {
  const provider = getEmbeddingProvider();
  if (!provider.isAvailable()) {
    logEvent("warn", "Re-index skipped — embedding provider unavailable");
    return 0;
  }

  // Find all chunks with NULL embeddings.
  const chunks = await prisma.knowledgeChunk.findMany({
    where: { embedding: { equals: Prisma.DbNull } },
    select: { id: true, content: true },
  });

  if (chunks.length === 0) {
    logEvent("info", "Re-index complete — no chunks missing embeddings");
    return 0;
  }

  logEvent("info", "Re-indexing chunks without embeddings", {
    count: chunks.length,
  });

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

  logEvent("info", "Re-index complete", { updated, total: chunks.length });
  return updated;
}

/** Convenience wrapper that logs and rethrows for API error handling. */
export async function safeReIndexMissingEmbeddings() {
  try {
    return await reIndexMissingEmbeddings();
  } catch (error) {
    logError("Knowledge re-index failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/** Fetches the analytics dashboard payload. */
export async function getKnowledgeAnalytics() {
  return getAnalyticsDashboard();
}

/** Fetches the quality check summary. */
export async function getKnowledgeQualitySummary() {
  return getQualitySummary();
}