import type { Chunk } from "./types";

/**
 * Configuration for the document splitter.
 */
export interface SplitOptions {
  /** Target chunk size in characters. Defaults to 500. */
  chunkSize?: number;
  /** Number of characters to overlap between consecutive chunks. Defaults to 100. */
  overlap?: number;
  /** When true (default), chunk boundaries prefer paragraph boundaries. */
  preserveParagraphs?: boolean;
}

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 100;

/**
 * Splits a document into size-bounded chunks while preserving paragraph
 * structure where possible.
 *
 * Algorithm:
 *   1. Normalize whitespace (collapse runs of blank lines).
 *   2. Split into paragraph units (lines separated by blank lines).
 *   3. Break any paragraph longer than `chunkSize` into sub-units sized
 *      `chunkSize` with `overlap`.
 *   4. Greedily merge consecutive units into chunks up to `chunkSize`.
 *   5. Carry the tail of the previous chunk into the next one as overlap.
 *
 * Fully typed, side-effect free, and reusable by any ingestion pipeline.
 *
 * @returns An array of Chunk rows (never null; empty for blank input).
 */
export function splitDocument(content: string, options: SplitOptions = {}): Chunk[] {
  const { chunkSize, overlap, preserveParagraphs = true } = options;

  const safeChunkSize = resolveChunkSize(chunkSize);
  const safeOverlap = resolveOverlap(overlap, safeChunkSize);

  const normalized = normalizeWhitespace(content);
  if (!normalized) return [];

  // Split into paragraph units, then break oversized units further.
  const units = preserveParagraphs ? splitParagraphs(normalized) : [normalized];
  const boundedUnits = units.flatMap((unit) => boundUnit(unit, safeChunkSize, safeOverlap));

  return mergeUnits(boundedUnits, safeChunkSize, safeOverlap);
}

/** Fall back to defaults when chunkSize is invalid (<= 0 or not finite). */
function resolveChunkSize(chunkSize: number | undefined): number {
  if (typeof chunkSize !== "number" || !Number.isFinite(chunkSize) || chunkSize <= 0) {
    return DEFAULT_CHUNK_SIZE;
  }
  return Math.floor(chunkSize);
}

/** Clamp overlap so it is never >= chunkSize and never negative. */
function resolveOverlap(overlap: number | undefined, chunkSize: number): number {
  if (typeof overlap !== "number" || !Number.isFinite(overlap) || overlap <= 0) {
    return DEFAULT_OVERLAP < chunkSize ? DEFAULT_OVERLAP : Math.floor(chunkSize / 2);
  }
  return Math.min(Math.floor(overlap), Math.max(0, chunkSize - 1));
}

/** Collapses blank-line runs and trims leading/trailing whitespace. */
function normalizeWhitespace(content: string): string {
  return content
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Splits normalized text into paragraphs separated by blank lines. */
function splitParagraphs(content: string): string[] {
  return content
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * If a paragraph exceeds chunkSize, break it at word boundaries into
 * sub-units no larger than chunkSize, carrying overlap between them.
 */
function boundUnit(unit: string, chunkSize: number, overlap: number): string[] {
  if (unit.length <= chunkSize) return [unit];
  return splitLongText(unit, chunkSize, overlap);
}

/** Word-boundary subdivision of text longer than chunkSize. */
function splitLongText(text: string, chunkSize: number, overlap: number): string[] {
  const words = text.split(/\s+/);
  const parts: string[] = [];
  let buffer: string[] = [];
  let bufferLength = 0;

  const flush = () => {
    if (buffer.length === 0) return;
    let joined = buffer.join(" ");
    if (parts.length > 0 && overlap > 0) {
      const previous = parts[parts.length - 1];
      joined = `${previous.slice(-overlap)} ${joined}`;
    }
    parts.push(joined.trim());
    buffer = [];
    bufferLength = 0;
  };

  for (const word of words) {
    const nextLength = bufferLength + (bufferLength > 0 ? 1 : 0) + word.length;
    if (nextLength > chunkSize && buffer.length > 0) {
      flush();
    }
    buffer.push(word);
    bufferLength += word.length + (bufferLength > 0 ? 1 : 0);
  }
  flush();

  return parts;
}

/**
 * Greedily merges paragraph units into chunks no larger than chunkSize and
 * injects `overlap` characters from the end of each chunk into the next.
 */
function mergeUnits(units: string[], chunkSize: number, overlap: number): Chunk[] {
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentLength = 0;

  const pushChunk = (text: string) => {
    const clean = text.trim();
    if (!clean) return;
    chunks.push({ index: chunks.length, content: clean });
  };

  for (const unit of units) {
    const separatorLength = current.length > 0 ? 2 : 0; // "\n\n"
    const nextLength = currentLength + separatorLength + unit.length;

    if (nextLength <= chunkSize) {
      current.push(unit);
      currentLength += separatorLength + unit.length;
      continue;
    }

    // Flush the accumulated unit(s) as a chunk.
    const merged = mergeUnitsText(current);
    if (merged) pushChunk(merged);

    // Start the next chunk; carry the tail overlap, if any.
    current = overlap > 0 && merged ? [overlapTail(merged, overlap), unit] : [unit];
    currentLength = current.reduce((sum, part) => sum + part.length, 0) + (current.length - 1) * 2;
  }

  if (current.length > 0) {
    const merged = mergeUnitsText(current);
    if (merged) pushChunk(merged);
  }

  return chunks;
}

/** Joins paragraph units with a blank line separator, trimming as needed. */
function mergeUnitsText(units: string[]): string {
  return units.join("\n\n").trim();
}

/** Returns the last `count` characters of a chunk (word-boundary trimmed). */
function overlapTail(text: string, count: number): string {
  return text.slice(-count);
}