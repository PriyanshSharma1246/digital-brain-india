import { promises as fs } from "node:fs";
import path from "node:path";
import type { ParsedMarkdown } from "./types";
import { parseMarkdown } from "./parser";
import { logError } from "@/lib/logger";

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);

/**
 * Recursively scans a directory for markdown files and parses each one.
 *
 * The loader walks every subdirectory under `rootDir`, reads all
 * .md/.markdown/.mdx files, extracts their frontmatter metadata, and
 * returns fully structured ParsedMarkdown objects ready for splitting.
 *
 * Files that fail to read or parse are logged and skipped so a single
 * corrupt file cannot abort an entire ingestion run.
 */
export async function loadMarkdownFromDirectory(rootDir: string): Promise<ParsedMarkdown[]> {
  const filePaths = await collectMarkdownFiles(rootDir);
  const documents: ParsedMarkdown[] = [];

  for (const filePath of filePaths) {
    try {
      const rawContent = await fs.readFile(filePath, "utf-8");
      const fileName = path.basename(filePath);
      documents.push(parseMarkdown({ path: filePath, fileName, rawContent }));
    } catch (error) {
      const fileName = path.basename(filePath);
      logError("Failed to load knowledge markdown file", {
        file: filePath,
        fileName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return documents;
}

/** Loads and parses a single markdown file (used by the ingestion service for direct imports). */
export async function loadMarkdownFile(filePath: string): Promise<ParsedMarkdown | null> {
  try {
    const rawContent = await fs.readFile(filePath, "utf-8");
    const fileName = path.basename(filePath);
    return parseMarkdown({ path: filePath, fileName, rawContent });
  } catch (error) {
    logError("Failed to load single knowledge markdown file", {
      file: filePath,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Recursively collects all markdown file paths under a directory. */
async function collectMarkdownFiles(rootDir: string): Promise<string[]> {
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
      const nested = await collectMarkdownFiles(fullPath);
      results.push(...nested);
    } else if (entry.isFile() && isMarkdownFile(entry.name)) {
      results.push(fullPath);
    }
  }

  return results.sort();
}

function isMarkdownFile(fileName: string): boolean {
  return MARKDOWN_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}