/**
 * Shared type definitions for the knowledge ingestion pipeline.
 *
 * These types describe the flow:
 *   Markdown file -> ParsedMarkdown (loader/parser) -> split chunks (splitter)
 *   -> KnowledgeDocument / KnowledgeChunk records (ingestion service).
 */

/** Supported knowledge categories, mirroring the knowledge/ corpus folders. */
export const KNOWLEDGE_CATEGORIES = [
  "agriculture",
  "education",
  "governance",
  "healthcare",
  "legal",
  "schemes",
  "taxation",
  "transport",
] as const;

export type KnowledgeCategory = (typeof KNOWLEDGE_CATEGORIES)[number];

/** Metadata extracted from a markdown document. */
export interface MarkdownMetadata {
  /** Document title. Falls back to the file name when absent. */
  title: string;
  /** Canonical category (e.g. "agriculture"). */
  category: KnowledgeCategory;
  /** Origin/source of the document, e.g. "Ministry of Agriculture". */
  source: string;
}

/** A markdown file that has been read from disk. */
export interface ParsedMarkdown {
  /** Absolute path of the source file. */
  path: string;
  /** File name (base name with extension). */
  fileName: string;
  /** Raw file contents (before frontmatter stripping). */
  rawContent: string;
  /** Metadata extracted from frontmatter and/or the file name. */
  metadata: MarkdownMetadata;
  /** Markdown body with frontmatter removed. */
  content: string;
}

/** A single chunk produced by the splitter. */
export interface Chunk {
  /** Zero-based index of the chunk within the document. */
  index: number;
  /** Chunk text content. */
  content: string;
}

/** A chunked document ready for persistence. */
export interface ChunkedDocument {
  document: {
    title: string;
    category: KnowledgeCategory;
    source: string;
    content: string;
    sourcePath: string | null;
    contentHash: string | null;
  };
  chunks: Chunk[];
}

/** Shape of the embedding vector when embeddings are computed (null for now). */
export type EmbeddingVector = number[] | null;

/** A chunk plus its generated embedding (stored as null until embeddings are wired). */
export interface EmbeddedChunk {
  chunk: Chunk;
  embedding: EmbeddingVector;
}