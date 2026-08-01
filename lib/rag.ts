import { INDIAN_KNOWLEDGE_BASE, type KnowledgeChunk } from "@/data/indianKnowledge";

const VECTOR_DIMENSION = 16;

function simpleHash(text: string) {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function tokenize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

function encodeText(text: string): number[] {
  const tokens = tokenize(text);
  const vector = Array.from({ length: VECTOR_DIMENSION }, () => 0);
  const counts = new Map<string, number>();

  for (const token of tokens) {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  }

  for (const [token, count] of counts.entries()) {
    const index = simpleHash(token) % VECTOR_DIMENSION;
    vector[index] += count;
  }

  return vector;
}

function cosineSimilarity(a: number[], b: number[]) {
  let dot = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dot / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}

function buildChunkEmbeddings(chunks: KnowledgeChunk[]) {
  return chunks.map((chunk) => ({
    ...chunk,
    embedding: encodeText(`${chunk.title} ${chunk.content}`),
  }));
}

const knowledgeEmbeddings = buildChunkEmbeddings(INDIAN_KNOWLEDGE_BASE);

export function searchKnowledge(query: string, topK = 4) {
  const queryVector = encodeText(query);
  const scored = knowledgeEmbeddings
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryVector, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored.filter((item) => item.score > 0.01);
}

export function buildKnowledgeContext(query: string, topK = 4) {
  const results = searchKnowledge(query, topK);
  if (!results.length) return "";

  return results
    .map((item) => {
      return `[Source: ${item.source}] ${item.title}\n${item.content}`;
    })
    .join("\n\n---\n\n");
}
