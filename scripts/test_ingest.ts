import path from "node:path";
import { Prisma } from "@prisma/client";
import { ingestDirectory } from "../lib/knowledge/ingest";
import { prisma } from "../lib/prisma";

async function main() {
  const corpusRoot = path.join(process.cwd(), "knowledge");

  console.log("=== First ingestion run ===");
  const first = await ingestDirectory(corpusRoot);
  console.log("First run result:", JSON.stringify(first));

  const docs = await prisma.knowledgeDocument.count();
  const chunks = await prisma.knowledgeChunk.count();
  console.log(`DB state after first run: docs=${docs}, chunks=${chunks}`);

  // Verify embeddings are null (per Task 6: store embedding as null).
  // JSON null filters require Prisma.DbNull on nullable Json columns.
  const chunkWithEmbedding = await prisma.knowledgeChunk.findFirst({
    where: { embedding: { not: Prisma.DbNull } },
  });
  console.log("Chunks with non-null embedding (should be 0):", chunkWithEmbedding ? 1 : 0);

  console.log("=== Second ingestion run (duplicate check) ===");
  const second = await ingestDirectory(corpusRoot);
  console.log("Second run result:", JSON.stringify(second));

  if (second.created !== 0) {
    console.error("FAIL: second run should not create documents");
    process.exitCode = 1;
    return;
  }
  if (second.skipped === 0) {
    console.error("FAIL: expected at least one skipped document");
    process.exitCode = 1;
    return;
  }

  console.log("PASS: ingestion pipeline works and deduplicates correctly");
}

main()
  .catch((error) => {
    console.error("Ingestion test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });