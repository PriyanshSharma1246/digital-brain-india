import { prisma } from "@/lib/prisma";
import { ingestParsedDocument } from "./ingest";
import { loadKnowledgeFromDirectory } from "./loader";
import { logEvent } from "@/lib/logger";
import type { KnowledgeContentType, ParsedDocument } from "./types";

/**
 * Background ingestion job service (Phase 9).
 *
 * Provides queued ingestion with progress tracking, per-document status,
 * retry support, and ingestion logs. Jobs are persisted in the IngestionJob
 * table and processed sequentially.
 */

export type JobType = "bulk" | "upload" | "reindex" | "reingest";
export type JobStatus = "queued" | "running" | "completed" | "failed";
export type JobItemStatus = "pending" | "processing" | "completed" | "failed" | "skipped";

/** Creates a new queued ingestion job. */
export async function createIngestionJob(
  type: JobType,
  documentIds: string[] = []
): Promise<string> {
  const job = await prisma.ingestionJob.create({
    data: {
      type,
      status: "queued",
      totalItems: documentIds.length,
      documents: documentIds.length > 0
        ? {
            create: documentIds.map((documentId) => ({
              documentId,
              status: "pending" as JobItemStatus,
            })),
          }
        : undefined,
    },
  });

  logEvent("info", "Ingestion job created", { jobId: job.id, type, items: documentIds.length });
  return job.id;
}

/** Marks a job as running and records the start time. */
export async function startJob(jobId: string): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });
}

/** Marks a job as completed with final counts. */
export async function completeJob(jobId: string): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { status: "completed", progress: 100, completedAt: new Date() },
  });
}

/** Marks a job as failed with an error message. */
export async function failJob(jobId: string, error: string): Promise<void> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { status: "failed", error, completedAt: new Date() },
  });
}

/** Updates job progress counters. */
export async function updateJobProgress(
  jobId: string,
  delta: { processed?: number; succeeded?: number; failed?: number }
): Promise<void> {
  const job = await prisma.ingestionJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  const processed = job.processedItems + (delta.processed ?? 0);
  const succeeded = job.succeededItems + (delta.succeeded ?? 0);
  const failed = job.failedItems + (delta.failed ?? 0);
  const progress = job.totalItems > 0 ? Math.round((processed / job.totalItems) * 100) : 100;

  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { processedItems: processed, succeededItems: succeeded, failedItems: failed, progress },
  });
}

/** Updates a single job-document item status. */
export async function updateJobItemStatus(
  jobId: string,
  documentId: string,
  status: JobItemStatus,
  error?: string
): Promise<void> {
  await prisma.ingestionJobDocument.updateMany({
    where: { jobId, documentId },
    data: {
      status,
      error: error ?? null,
      completedAt: status === "completed" || status === "failed" ? new Date() : null,
    },
  });
}

/** Adds a log line to a job. */
export async function addJobLog(
  jobId: string,
  level: "info" | "warn" | "error",
  message: string,
  documentId?: string
): Promise<void> {
  await prisma.ingestionLog.create({
    data: { jobId, level, message, documentId },
  });
}

/** Fetches a job with its logs and document items. */
export async function getJob(jobId: string) {
  return prisma.ingestionJob.findUnique({
    where: { id: jobId },
    include: {
      logs: { orderBy: { createdAt: "asc" } },
      documents: {
        include: { document: { select: { id: true, title: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

/** Lists recent jobs, newest first. */
export async function listJobs(limit = 20) {
  return prisma.ingestionJob.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      _count: { select: { documents: true, logs: true } },
    },
  });
}

/** Retries failed documents in a job by re-queuing them. */
export async function retryFailedDocuments(jobId: string): Promise<number> {
  const failed = await prisma.ingestionJobDocument.findMany({
    where: { jobId, status: "failed" },
    select: { documentId: true },
  });

  if (failed.length === 0) return 0;

  await prisma.ingestionJobDocument.updateMany({
    where: { jobId, status: "failed" },
    data: { status: "pending", error: null, completedAt: null },
  });

  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: { status: "queued", failedItems: 0, processedItems: 0, progress: 0 },
  });

  logEvent("info", "Retrying failed documents", { jobId, count: failed.length });
  return failed.length;
}

/** Processes a bulk ingestion job (directory scan). */
export async function processBulkJob(jobId: string, rootDir: string): Promise<void> {
  await startJob(jobId);
  await addJobLog(jobId, "info", `Starting bulk ingestion from ${rootDir}`);

  try {
    const documents = await loadKnowledgeFromDirectory(rootDir);
    await prisma.ingestionJob.update({
      where: { id: jobId },
      data: { totalItems: documents.length },
    });

    for (const document of documents) {
      const outcome = await ingestParsedDocument(document);
      await updateJobItemStatus(jobId, document.path ?? "", outcome === "failed" ? "failed" : outcome === "skipped" ? "skipped" : "completed");
      await updateJobProgress(jobId, {
        processed: 1,
        succeeded: outcome === "created" || outcome === "updated" ? 1 : 0,
        failed: outcome === "failed" ? 1 : 0,
      });
      await addJobLog(
        jobId,
        outcome === "failed" ? "error" : "info",
        `${document.metadata.title}: ${outcome}`,
        document.path ?? undefined
      );
    }

    await completeJob(jobId);
    await addJobLog(jobId, "info", "Bulk ingestion completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(jobId, message);
    await addJobLog(jobId, "error", `Bulk ingestion failed: ${message}`);
  }
}

/** Processes a re-ingest job (re-scan the corpus directory). */
export async function processReingestJob(jobId: string, rootDir: string): Promise<void> {
  await processBulkJob(jobId, rootDir);
}

/** Processes a single-document re-index job. */
export async function processReindexJob(jobId: string, documentId: string): Promise<void> {
  await startJob(jobId);
  await addJobLog(jobId, "info", `Re-indexing document ${documentId}`);

  try {
    const document = await prisma.knowledgeDocument.findUnique({
      where: { id: documentId },
      select: { id: true, title: true, content: true, contentType: true },
    });

    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Re-ingest the document content (re-splits and re-embeds).
    const parsed: ParsedDocument = {
      path: null,
      fileName: document.title,
      rawContent: document.content,
      metadata: {
        title: document.title,
        category: "governance",
        language: "en",
        source: "Re-index",
        tags: [],
      },
      content: document.content,
      contentType: document.contentType as KnowledgeContentType,
    };

    const outcome = await ingestParsedDocument(parsed);
    await updateJobItemStatus(jobId, documentId, outcome === "failed" ? "failed" : "completed");
    await updateJobProgress(jobId, { processed: 1, succeeded: outcome === "failed" ? 0 : 1, failed: outcome === "failed" ? 1 : 0 });
    await addJobLog(jobId, outcome === "failed" ? "error" : "info", `Re-index ${document.title}: ${outcome}`, documentId);

    if (outcome === "failed") {
      await failJob(jobId, `Re-index failed for ${document.title}`);
    } else {
      await completeJob(jobId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(jobId, message);
    await addJobLog(jobId, "error", `Re-index failed: ${message}`, documentId);
  }
}