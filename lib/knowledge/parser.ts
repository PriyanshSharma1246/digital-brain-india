import path from "node:path";
import {
  KNOWLEDGE_CATEGORIES,
  type KnowledgeCategory,
  type MarkdownMetadata,
  type ParsedMarkdown,
} from "./types";
import { logError } from "@/lib/logger";

const DEFAULT_SOURCE = "India Digital Brain Knowledge Base";
const FRONTMATTER_DELIMITER = "---";

/**
 * Parses a markdown file into a structured ParsedMarkdown object.
 *
 * Supported frontmatter fields (simple `key: value` lines):
 *   title:    Document title
 *   category: One of KNOWLEDGE_CATEGORIES
 *   source:   Origin of the document
 *
 * Missing fields fall back to:
 *   title    -> file base name
 *   category -> parent folder name (if it matches a known category)
 *   source   -> DEFAULT_SOURCE
 */
export function parseMarkdown(options: {
  path: string;
  fileName: string;
  rawContent: string;
}): ParsedMarkdown {
  const { path: filePath, fileName, rawContent } = options;

  // --- Split frontmatter from the body ------------------------------------
  const { frontmatter, body } = extractFrontmatter(rawContent);

  // --- Resolve metadata with sensible fallbacks ---------------------------
  const category = resolveCategory(frontmatter.category, filePath);
  const title = cleanValue(frontmatter.title) || titleFromFileName(fileName);
  const source = cleanValue(frontmatter.source) || DEFAULT_SOURCE;

  const metadata: MarkdownMetadata = { title, category, source };

  return {
    path: filePath,
    fileName,
    rawContent,
    metadata,
    content: body,
  };
}

/** Splits raw markdown into an optional frontmatter block and the body. */
function extractFrontmatter(raw: string): {
  frontmatter: Record<string, string>;
  body: string;
} {
  const lines = raw.split(/\r?\n/);

  if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
    return { frontmatter: {}, body: raw };
  }

  const endIndex = lines.slice(1).findIndex((line) => line.trim() === FRONTMATTER_DELIMITER);
  if (endIndex === -1) {
    // No closing delimiter: treat the whole file as body.
    return { frontmatter: {}, body: raw };
  }

  const frontmatterLines = lines.slice(1, 1 + endIndex);
  const body = lines.slice(2 + endIndex).join("\n").trim();

  const frontmatter: Record<string, string> = {};
  for (const line of frontmatterLines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    if (key) frontmatter[key] = value;
  }

  return { frontmatter, body };
}

/** Infers the category from frontmatter, else from the containing folder. */
function resolveCategory(raw: string | undefined, filePath: string): KnowledgeCategory {
  const fromFrontmatter = normalizeCategory(raw);
  if (fromFrontmatter) return fromFrontmatter;

  const folderName = containingFolder(filePath);
  const fromFolder = normalizeCategory(folderName);
  if (fromFolder) return fromFolder;

  logError("Knowledge document has an unknown category", {
    path: filePath,
    rawCategory: raw ?? null,
    folder: folderName,
  });
  return "governance";
}

/** Returns a valid category or null. Warns (via caller) on unknown values. */
function normalizeCategory(value: string | undefined): KnowledgeCategory | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "-");
  if (KNOWLEDGE_CATEGORIES.includes(normalized as KnowledgeCategory)) {
    return normalized as KnowledgeCategory;
  }
  return null;
}

function cleanValue(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "");
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.[^/.]+$/, "") // strip extension
    .replace(/[-_]+/g, " ")
    .trim();
}

function containingFolder(filePath: string): string {
  return path.basename(path.dirname(filePath));
}