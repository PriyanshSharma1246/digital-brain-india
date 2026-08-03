import { GoogleGenAI } from "@google/genai";
import type { EmbeddingVector } from "@/lib/knowledge/types";
import { logError, logEvent } from "@/lib/logger";

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
   * Whether the provider is ready to produce embeddings.
   * Returns false when the API key is missing or the provider is a stub.
   */
  isAvailable(): boolean;
  /**
   * Produces the embedding vector for a piece of text.
   * Returns null when embeddings are not available yet.
   */
  generateEmbedding(text: string): Promise<EmbeddingVector>;
  /**
   * Produces embeddings for multiple texts in a single batch call.
   * Returns an array with null entries for texts that failed.
   */
  embedBatch(texts: string[]): Promise<EmbeddingVector[]>;
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

  isAvailable(): boolean {
    return false;
  }

  async generateEmbedding(_text: string): Promise<EmbeddingVector> {
    return null;
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    return texts.map(() => null);
  }
}

/**
 * Google Gemini embedding provider.
 *
 * Uses the `text-embedding-004` model via the @google/genai SDK. The model
 * produces 768-dimensional vectors by default. Falls back to `null` when the
 * API key is missing or the API call fails.
 */
export class GeminiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "gemini-text-embedding-004";
  readonly dimensions = 768;

  private readonly ai: GoogleGenAI | null;

  constructor(apiKey?: string) {
    this.ai = apiKey ? new GoogleGenAI({ apiKey }) : null;
  }

  isAvailable(): boolean {
    return this.ai !== null;
  }

  async generateEmbedding(text: string): Promise<EmbeddingVector> {
    if (!this.ai) return null;

    try {
      const response = await this.ai.models.embedContent({
        model: "text-embedding-004",
        contents: [{ text }],
      });
      const values = response.embeddings?.[0]?.values;
      return values && values.length > 0 ? values : null;
    } catch (error) {
      logError("Gemini embedding generation failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async embedBatch(texts: string[]): Promise<EmbeddingVector[]> {
    if (!this.ai) return texts.map(() => null);

    const results: EmbeddingVector[] = [];
    // Process in small batches to stay within API limits.
    const BATCH_SIZE = 10;
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      try {
        const response = await this.ai.models.embedContent({
          model: "text-embedding-004",
          contents: batch.map((text) => ({ text })),
        });
        const embeddings = response.embeddings ?? [];
        for (let j = 0; j < batch.length; j++) {
          const values = embeddings[j]?.values;
          results.push(values && values.length > 0 ? values : null);
        }
      } catch (error) {
        logError("Gemini batch embedding failed", {
          batchStart: i,
          batchSize: batch.length,
          error: error instanceof Error ? error.message : String(error),
        });
        // Push nulls for the failed batch so the caller can still proceed.
        for (let j = 0; j < batch.length; j++) {
          results.push(null);
        }
      }
    }
    return results;
  }
}

let provider: EmbeddingProvider | null = null;

/**
 * Returns the active embedding provider (singleton).
 *
 * Uses Gemini when GEMINI_API_KEY is present, otherwise falls back to the
 * null provider (keyword-only search).
 */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!provider) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      provider = new GeminiEmbeddingProvider(apiKey);
      logEvent("info", "Embedding provider initialized", {
        provider: provider.name,
        dimensions: provider.dimensions,
      });
    } else {
      provider = new NullEmbeddingProvider();
      logEvent("warn", "Embedding provider unavailable — using keyword search fallback");
    }
  }
  return provider;
}

/** Convenience wrapper used by the ingestion/search pipeline. */
export async function embedText(text: string): Promise<EmbeddingVector> {
  return getEmbeddingProvider().generateEmbedding(text);
}

/** Convenience wrapper for batch embedding used by the ingestion pipeline. */
export async function embedTexts(texts: string[]): Promise<EmbeddingVector[]> {
  return getEmbeddingProvider().embedBatch(texts);
}