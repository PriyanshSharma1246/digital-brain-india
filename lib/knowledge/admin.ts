import path from "node:path";
import { prisma } from "@/lib/prisma";
import { ingestDirectory } from "./ingest";
import { logError } from "@/lib/logger";

/**
 * Admin service for the Knowledge Management Dashboard.
 *
 * These functions power the /admin/knowledge route and its API endpoints.
 * They intentionally reuse the existing ingestion pipeline (lib/knowledge/ingest)
 * rather than duplicating any parsing/splitting/persistence logic.
 */

/** Absolute path of the markdown corpus directory. */
export const KNOWLEDGE_CORPUS_DIR = path.join(process.cwd(), "knowledge");

/** A document row with its chunk count, as shown in the dashboard table. */
export interface KnowledgeDocumentSummary {
  id: string;
  title: string;
  category: string;
  source: string;
  sourcePath: string | null;
  contentHash: string | null;
  chunkCount: number;
  createdAt: Date;
  updatedAt: Date;
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
  length: number;
  createdAt: Date;
}

/** Full document detail including metadata, markdown body and chunks. */
export interface KnowledgeDocumentDetail {
  id: string;
  title: string;
  category: string;
  source: string;
  content: string;
  sourcePath: string | null;
  contentHash: string | null;
  createdAt: Date;
  updatedAt: Date;
  chunks: KnowledgeChunkDetail[];
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
    category: doc.category,
    source: doc.source,
    sourcePath: doc.sourcePath,
    contentHash: doc.contentHash,
    chunkCount: doc._count.chunks,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
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

/** Fetches a single document with its ordered chunks for the detail view. */
export async function getKnowledgeDocumentDetail(id: string): Promise<KnowledgeDocumentDetail | null> {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id },
    include: {
      chunks: {
        orderBy: { chunkIndex: "asc" },
      },
    },
  });

  if (!document) return null;

  return {
    id: document.id,
    title: document.title,
    category: document.category,
    source: document.source,
    content: document.content,
    sourcePath: document.sourcePath,
    contentHash: document.contentHash,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    chunks: document.chunks.map((chunk) => ({
      id: chunk.id,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      length: chunk.content.length,
      createdAt: chunk.createdAt,
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