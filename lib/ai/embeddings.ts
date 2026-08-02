import type { EmbeddingVector } from "@/lib/knowledge/types";

/**
 * Embedding provider contract.
 *
 * The RAG pipeline depends on this interface (Dependency Inversion) so the
 * concrete provider (e.g. Gemini embeddings) can be swapped in later without
 * changing the ingestion/search code. Until then, NullEmbeddingProvider is
 * used and every embedding is stored as `null`.
 */
export interface EmbeddingProvider {
  /** Provider identifier used in logs, e.g. "gemini-text-embedding-004". */
  readonly name: string;
  /** Dimensionality of produced vectors (0 when the provider is a stub). */
  readonly dimensions: number;
  /**
   * Produces the embedding vector for a piece of text.
   * Returns null when embeddings are not available yet.
   */
  generateEmbedding(text: string): Promise<EmbeddingVector>;
}

/**
 * Placeholder provider that emits `null` embeddings.
 *
 * Kept in place until the real embedding backend is wired up. The interface
 * stays stable so swapping implementations is a one-line factory change.
 */
export class NullEmbeddingProvider implements EmbeddingProvider {
  readonly name = "null";
  readonly dimensions = 0;

  async generateEmbedding(_text: string): Promise<EmbeddingVector> {
    // TODO(phase-3): wire in a real embedding model (e.g. Gemini
    // text-embedding-004) and return number[].
    return null;
  }
}

let provider: EmbeddingProvider | null = null;

/**
 * Returns the active embedding provider (singleton).
 *
 * Upgrading to a real provider later only requires changing this factory.
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!provider) {
    provider = new NullEmbeddingProvider();
  }
  return provider;
}

/** Convenience wrapper used by the ingestion/search pipeline. */
export async function embedText(text: string): Promise<EmbeddingVector> {
  return getEmbeddingProvider().generateEmbedding(text);
}