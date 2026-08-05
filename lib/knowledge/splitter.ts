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
  /** When true (default), markdown headings are preserved as heading metadata. */
  preserveHeadings?: boolean;
  /** When true (default), markdown tables are kept together in a single chunk. */
  keepTablesTogether?: boolean;
}

const DEFAULT_CHUNK_SIZE = 500;
const DEFAULT_OVERLAP = 100;

/**
 * Splits a document into size-bounded chunks while preserving:
 *   - Paragraph structure (when preserveParagraphs is true)
 *   - Markdown heading hierarchy (when preserveHeadings is true)
 *   - Markdown tables (when keepTablesTogether is true)
 *
 * Algorithm:
 *   1. Normalize whitespace (collapse runs of blank lines).
 *   2. Split into paragraph units (lines separated by blank lines).
 *   3. Track the current heading hierarchy as headings are encountered.
 *   4. Keep markdown tables together as a single unit.
 *   5. Break any paragraph longer than `chunkSize` into sub-units sized
 *      `chunkSize` with `overlap`.
 *   6. Greedily merge consecutive units into chunks up to `chunkSize`.
 *   7. Carry the tail of the previous chunk into the next one as overlap.
 *
 * Fully typed, side-effect free, and reusable by any ingestion pipeline.
 *
 * @returns An array of Chunk rows (never null; empty for blank input).
 */
export function splitDocument(content: string, options: SplitOptions = {}): Chunk[] {
  const {
    chunkSize,
    overlap,
    preserveParagraphs = true,
    preserveHeadings = true,
    keepTablesTogether = true,
  } = options;

  const safeChunkSize = resolveChunkSize(chunkSize);
  const safeOverlap = resolveOverlap(overlap, safeChunkSize);

  const normalized = normalizeWhitespace(content);
  if (!normalized) return [];

  // Split into paragraph units, then break oversized units further.
  const units = preserveParagraphs ? splitParagraphs(normalized) : [normalized];
  const boundedUnits = units.flatMap((unit) => boundUnit(unit, safeChunkSize, safeOverlap));

  // Build chunks with heading hierarchy tracking.
  return buildChunks(boundedUnits, safeChunkSize, safeOverlap, {
    preserveHeadings,
    keepTablesTogether,
  });
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

/** Options for the chunk-building phase. */
interface BuildChunkOptions {
  preserveHeadings: boolean;
  keepTablesTogether: boolean;
}

/** Heading detection result. */
interface HeadingInfo {
  /** Full heading hierarchy path. */
  path: string[];
  /** The immediate heading text. */
  heading: string;
}

/**
 * Detects a markdown heading line and returns its hierarchy.
 * Returns null when the unit is not a heading.
 */
function detectHeading(unit: string): HeadingInfo | null {
  const match = unit.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  const heading = match[2].trim();
  return { path: [heading], heading };
}

/**
 * Detects whether a unit looks like a markdown table.
 * A table has a header row, a separator row of dashes, and at least one body row.
 */
function looksLikeTable(unit: string): boolean {
  const lines = unit.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length < 3) return false;
  // The second line must be a separator row like | --- | --- |
  const separator = lines[1];
  if (!separator.startsWith("|") && !separator.startsWith("|-")) return false;
  return /^\|?[\s:|-]+\|?$/.test(separator) && separator.includes("-");
}

/**
 * Greedily merges paragraph units into chunks no larger than chunkSize,
 * tracking heading hierarchy and table boundaries as it goes.
 */
function buildChunks(
  units: string[],
  chunkSize: number,
  overlap: number,
  options: BuildChunkOptions
): Chunk[] {
  const chunks: Chunk[] = [];
  let current: string[] = [];
  let currentLength = 0;
  let currentHeadingPath: string[] = [];
  let currentHeading: string | null = null;
  let currentHasTable = false;

  const pushChunk = (
    text: string,
    headingPath: string[],
    heading: string | null,
    hasTable: boolean
  ) => {
    const clean = text.trim();
    if (!clean) return;
    chunks.push({
      index: chunks.length,
      content: clean,
      headingPath,
      heading,
      hasTable,
    });
  };

  for (const unit of units) {
    // Detect heading lines and update the hierarchy.
    const headingInfo = options.preserveHeadings ? detectHeading(unit) : null;
    if (headingInfo) {
      // Flush the current chunk before starting a new heading section.
      if (current.length > 0) {
        const merged = mergeUnitsText(current);
        if (merged) pushChunk(merged, currentHeadingPath, currentHeading, currentHasTable);
        current = [];
        currentLength = 0;
        currentHasTable = false;
      }
      currentHeadingPath = headingInfo.path;
      currentHeading = headingInfo.heading;
      continue;
    }

    // Detect tables and keep them together when requested.
    const isTable = options.keepTablesTogether && looksLikeTable(unit);
    if (isTable) {
      // Flush the current chunk so the table stays together.
      if (current.length > 0) {
        const merged = mergeUnitsText(current);
        if (merged) pushChunk(merged, currentHeadingPath, currentHeading, currentHasTable);
        current = [];
        currentLength = 0;
      }
      // If the table fits in a chunk, emit it as its own chunk.
      if (unit.length <= chunkSize) {
        pushChunk(unit, currentHeadingPath, currentHeading, true);
        continue;
      }
      // Oversized table: fall through to normal merging with hasTable=true.
      currentHasTable = true;
    }

    const separatorLength = current.length > 0 ? 2 : 0; // "\n\n"
    const nextLength = currentLength + separatorLength + unit.length;

    if (nextLength <= chunkSize) {
      current.push(unit);
      currentLength += separatorLength + unit.length;
      continue;
    }

    // Flush the accumulated unit(s) as a chunk.
    const merged = mergeUnitsText(current);
    if (merged) pushChunk(merged, currentHeadingPath, currentHeading, currentHasTable);

    // Start the next chunk; carry the tail overlap, if any.
    current = overlap > 0 && merged ? [overlapTail(merged, overlap), unit] : [unit];
    currentLength =
      current.reduce((sum, part) => sum + part.length, 0) + (current.length - 1) * 2;
    currentHasTable = isTable;
  }

  if (current.length > 0) {
    const merged = mergeUnitsText(current);
    if (merged) pushChunk(merged, currentHeadingPath, currentHeading, currentHasTable);
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