import { searchKnowledge, retrieveRelevantChunks, buildKnowledgeContext } from "../lib/ai/rag";
import { prisma } from "../lib/prisma";

async function main() {
  console.log("=== searchKnowledge() ===");
  const result = await searchKnowledge("PM-KISAN farmer income support", { topK: 3, category: "agriculture" });
  console.log(`chunks=${result.chunks.length}, usedEmbeddings=${result.usedEmbeddings}`);

  for (const chunk of result.chunks) {
    console.log(`- [${chunk.chunkIndex}] ${chunk.documentTitle} (${chunk.category}) len=${chunk.content.length} score=${chunk.score.toFixed(4)}`);
  }

  console.log("\n=== retrieveRelevantChunks() ===");
  const chunks = await retrieveRelevantChunks("income support", { topK: 2 });
  console.log(`chunks=${chunks.length}`);

  console.log("\n=== buildKnowledgeContext() ===");
  const context = buildKnowledgeContext(chunks);
  console.log(context.slice(0, 200));

  if (result.chunks.length === 0) {
    console.error("FAIL: expected at least one retrieved chunk");
    process.exitCode = 1;
    return;
  }

  console.log("\nPASS: search infrastructure works with hybrid retrieval");
}

main()
  .catch((error) => {
    console.error("Search test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });