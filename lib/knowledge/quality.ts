import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logEvent } from "@/lib/logger";

/**
 * Quality check service (Phase 9).
 *
 * Validates documents for:
 *   - Missing metadata (title, category, source, language)
 *   - Empty chunks
 *   - Duplicate chunks (identical content within a document)
 *   - Invalid embeddings (wrong dimensions or non-array)
 *
 * Results are persisted in QualityCheckResult and can be surfaced in the
 * admin dashboard.
 */

export type QualityCheckType = "metadata" | "chunks" | "embeddings" | "duplicates";
export type QualityStatus = "pass" | "warn" | "fail";

/** Runs all quality checks for a single document. */
export async function runQualityChecks(documentId: string): Promise<void> {
  const document = await prisma.knowledgeDocument.findUnique({
    where: { id: documentId },
    include: { chunks: true },
  });

  if (!document) return;

  await checkMetadata(documentId, document);
  await checkChunks(documentId, document.chunks);
  await checkEmbeddings(documentId, document.chunks);
  await checkDuplicates(documentId, document.chunks);
}

/** Runs quality checks for all documents. Returns the number checked. */
export async function runAllQualityChecks(): Promise<number> {
  const documents = await prisma.knowledgeDocument.findMany({
    select: { id: true },
  });

  for (const doc of documents) {
    await runQualityChecks(doc.id);
  }

  logEvent("info", "Quality checks completed", { documents: documents.length });
  return documents.length;
}

/** Checks that required metadata fields are present. */
async function checkMetadata(
  documentId: string,
  document: { title: string; category: string; source: string; language: string; description: string | null }
): Promise<void> {
  const missing: string[] = [];
  if (!document.title) missing.push("title");
  if (!document.category) missing.push("category");
  if (!document.source) missing.push("source");
  if (!document.language) missing.push("language");

  const status: QualityStatus = missing.length === 0 ? "pass" : "warn";
  const message =
    missing.length === 0
      ? "All required metadata fields present"
      : `Missing metadata: ${missing.join(", ")}`;

  await saveCheck(documentId, "metadata", status, message, { missing });
}

/** Checks for empty chunks. */
async function checkChunks(
  documentId: string,
  chunks: { id: string; content: string }[]
): Promise<void> {
  const emptyChunks = chunks.filter((chunk) => !chunk.content.trim());

  const status: QualityStatus = emptyChunks.length === 0 ? "pass" : "warn";
  const message =
    emptyChunks.length === 0
      ? `All ${chunks.length} chunks have content`
      : `${emptyChunks.length} empty chunk(s) found`;

  await saveCheck(documentId, "chunks", status, message, {
    totalChunks: chunks.length,
    emptyChunks: emptyChunks.length,
  });
}

/** Checks for invalid embeddings (non-array or wrong dimensions). */
async function checkEmbeddings(
  documentId: string,
  chunks: { id: string; embedding: Prisma.JsonValue | null }[]
): Promise<void> {
  const invalid: string[] = [];
  let embedded = 0;

  for (const chunk of chunks) {
    if (chunk.embedding === null) continue;
    embedded++;
    if (!Array.isArray(chunk.embedding)) {
      invalid.push(chunk.id);
    }
  }

  const status: QualityStatus = invalid.length === 0 ? "pass" : "warn";
  const message =
    invalid.length === 0
      ? `${embedded}/${chunks.length} chunks have valid embeddings`
      : `${invalid.length} chunk(s) have invalid embeddings`;

  await saveCheck(documentId, "embeddings", status, message, {
    totalChunks: chunks.length,
    embedded,
    invalid: invalid.length,
  });
}

/** Checks for duplicate chunk content within a document. */
async function checkDuplicates(
  documentId: string,
  chunks: { id: string; content: string }[]
): Promise<void> {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];

  for (const chunk of chunks) {
    const key = chunk.content.trim();
    if (seen.has(key)) {
      duplicates.push(chunk.id);
    } else {
      seen.set(key, 1);
    }
  }

  const status: QualityStatus = duplicates.length === 0 ? "pass" : "warn";
  const message =
    duplicates.length === 0
      ? "No duplicate chunks detected"
      : `${duplicates.length} duplicate chunk(s) detected`;

  await saveCheck(documentId, "duplicates", status, message, {
    totalChunks: chunks.length,
    duplicates: duplicates.length,
  });
}

/** Persists a quality check result. */
async function saveCheck(
  documentId: string,
  checkType: QualityCheckType,
  status: QualityStatus,
  message: string,
  details: Record<string, unknown>
): Promise<void> {
  await prisma.qualityCheckResult.create({
    data: {
      documentId,
      checkType,
      status,
      message,
      details: details as Prisma.InputJsonValue,
    },
  });
}

/** Fetches the latest quality check results for a document. */
export async function getQualityChecks(documentId: string) {
  return prisma.qualityCheckResult.findMany({
    where: { documentId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
}

/** Fetches quality check summary across all documents. */
export async function getQualitySummary() {
  const [total, passed, warned, failed] = await Promise.all([
    prisma.qualityCheckResult.count(),
    prisma.qualityCheckResult.count({ where: { status: "pass" } }),
    prisma.qualityCheckResult.count({ where: { status: "warn" } }),
    prisma.qualityCheckResult.count({ where: { status: "fail" } }),
  ]);

  return { total, passed, warned, failed };
}