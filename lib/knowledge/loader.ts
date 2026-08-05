import { promises as fs } from "node:fs";
import path from "node:path";
import type { KnowledgeContentType, ParsedDocument } from "./types";
import { parseDocument } from "./parser";
import { logError } from "@/lib/logger";

const SUPPORTED_EXTENSIONS = new Set([
  ".md",
  ".markdown",
  ".mdx",
  ".pdf",
  ".docx",
  ".txt",
  ".html",
  ".htm",
]);

/**
 * Loads and parses source files from disk.
 *
 * Phase 9 supports markdown, PDF, DOCX, TXT, and HTML. Markdown files are
 * parsed with frontmatter metadata extraction. Other formats are read as
 * plain text (PDF/DOCX extraction is handled by the upload pipeline via
 * lib/fileProcessing.ts; the loader here handles raw text formats).
 *
 * Files that fail to read or parse are logged and skipped so a single
 * corrupt file cannot abort an entire ingestion run.
 */

/** Recursively scans a directory for supported knowledge files and parses each one. */
export async function loadKnowledgeFromDirectory(rootDir: string): Promise<ParsedDocument[]> {
  const filePaths = await collectKnowledgeFiles(rootDir);
  const documents: ParsedDocument[] = [];

  for (const filePath of filePaths) {
    try {
      const rawContent = await fs.readFile(filePath, "utf-8");
      const fileName = path.basename(filePath);
      const contentType = contentTypeFromFileName(fileName);
      documents.push(
        parseDocument({ path: filePath, fileName, rawContent, contentType })
      );
    } catch (error) {
      const fileName = path.basename(filePath);
      logError("Failed to load knowledge file", {
        file: filePath,
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return documents;
}

/** Backwards-compatible alias for markdown-only directory loading. */
export async function loadMarkdownFromDirectory(rootDir: string): Promise<ParsedDocument[]> {
  return loadKnowledgeFromDirectory(rootDir);
}

/** Loads and parses a single file (used by the ingestion service for direct imports). */
export async function loadKnowledgeFile(filePath: string): Promise<ParsedDocument | null> {
  try {
    const rawContent = await fs.readFile(filePath, "utf-8");
    const fileName = path.basename(filePath);
    const contentType = contentTypeFromFileName(fileName);
    return parseDocument({ path: filePath, fileName, rawContent, contentType });
  } catch (error) {
    logError("Failed to load single knowledge file", {
      file: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Backwards-compatible alias for single markdown file loading. */
export async function loadMarkdownFile(filePath: string): Promise<ParsedDocument | null> {
  return loadKnowledgeFile(filePath);
}

/** Recursively collects all supported knowledge file paths under a directory. */
async function collectKnowledgeFiles(rootDir: string): Promise<string[]> {
  const results: string[] = [];

  let entries;
  try {
    entries = await fs.readdir(rootDir, { withFileTypes: true });
  } catch (error) {
    logError("Knowledge directory does not exist or is unreadable", {
      rootDir,
      error: error instanceof Error ? error.message : String(error),
    });
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);

    if (entry.isDirectory()) {
      // Skip hidden directories (e.g. .git) to avoid traversing out-of-band content.
      if (entry.name.startsWith(".")) continue;
      const nested = await collectKnowledgeFiles(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && isSupportedFile(entry.name)) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function isSupportedFile(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

/** Maps a file extension to its knowledge content type. */
export function contentTypeFromFileName(fileName: string): KnowledgeContentType {
  const ext = path.extname(fileName).toLowerCase();
  switch (ext) {
    case ".md":
    case ".markdown":
    case ".mdx":
      return "markdown";
    case ".pdf":
      return "pdf";
    case ".docx":
      return "docx";
    case ".html":
    case ".htm":
      return "html";
    case ".txt":
    default:
      return "txt";
  }
}