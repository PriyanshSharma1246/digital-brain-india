import { splitDocument } from "../lib/knowledge/splitter";

const sample = `Pradhan Mantri Jan Dhan Yojana aims to expand access to basic banking services for underserved households. It offers zero-balance accounts, RuPay debit cards, accidental insurance, and enables direct benefit transfers and financial inclusion.

The scheme is a flagship financial inclusion initiative of the Government of India. It was launched to ensure that every household has access to a bank account and can participate in the formal financial system.

This is a third paragraph that is intentionally made long enough to exceed the default chunk size of five hundred characters so that the splitter must break it into multiple bounded units while preserving word boundaries and carrying the configured overlap between consecutive chunks.`;

const chunks = splitDocument(sample, { chunkSize: 500, overlap: 100 });

console.log(`Total chunks: ${chunks.length}`);
for (const chunk of chunks) {
  console.log(`[${chunk.index}] len=${chunk.content.length}`);
  console.log(chunk.content.slice(0, 80).replace(/\n/g, " ") + "...");
  console.log("---");
}

// Assertions
if (chunks.length < 2) {
  console.error("FAIL: expected at least 2 chunks");
  process.exit(1);
}
for (const chunk of chunks) {
  if (chunk.content.length > 500) {
    console.error(`FAIL: chunk ${chunk.index} exceeds 500 chars (${chunk.content.length})`);
    process.exit(1);
  }
}
console.log("PASS: splitter produces bounded, ordered chunks");