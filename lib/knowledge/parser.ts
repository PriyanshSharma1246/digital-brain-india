import path from "node:path";
import {
  KNOWLEDGE_CATEGORIES,
  KNOWLEDGE_LANGUAGES,
  type DocumentMetadata,
  type KnowledgeCategory,
  type KnowledgeContentType,
  type KnowledgeLanguage,
  type ParsedDocument,
} from "./types";
import { logError } from "@/lib/logger";

const DEFAULT_SOURCE = "India Digital Brain Knowledge Base";
const FRONTMATTER_DELIMITER = "---";

/**
 * Parses a source file into a structured ParsedDocument object.
 *
 * Supported frontmatter fields (simple `key: value` lines):
 *   title, description, category, subcategory, state, ministry, language,
 *   source, source_url, published_at, tags, version
 *
 * Missing fields fall back to:
 *   title    -> file base name
 *   category -> parent folder name (if it matches a known category)
 *   source   -> DEFAULT_SOURCE
 *   language -> "en"
 *   tags     -> []
 */

/** Parses a document from raw content with full metadata extraction. */
export function parseDocument(options: {
  path: string | null;
  fileName: string;
  rawContent: string;
  contentType: KnowledgeContentType;
}): ParsedDocument {
  const { path: filePath, fileName, rawContent, contentType } = options;

  // --- Split frontmatter from the body ------------------------------------
  const { frontmatter, body } = extractFrontmatter(rawContent);

  // --- Resolve metadata with sensible fallbacks ---------------------------
  const category = resolveCategory(frontmatter.category, filePath);
  const title = cleanValue(frontmatter.title) || titleFromFileName(fileName);
  const source = cleanValue(frontmatter.source) || DEFAULT_SOURCE;
  const language = resolveLanguage(frontmatter.language);
  const tags = parseTags(frontmatter.tags);
  const publishedAt = parseDate(frontmatter.published_at) ?? parseDate(frontmatter.publishedAt);

  const metadata: DocumentMetadata = {
    title,
    description: cleanValue(frontmatter.description) || null,
    category,
    subcategory: cleanValue(frontmatter.subcategory) || null,
    state: cleanValue(frontmatter.state) || null,
    ministry: cleanValue(frontmatter.ministry) || null,
    language,
    source,
    sourceUrl: cleanValue(frontmatter.source_url) ?? cleanValue(frontmatter.sourceUrl) ?? null,
    publishedAt,
    tags,
    version: cleanValue(frontmatter.version) || null,
  };

  return {
    path: filePath,
    fileName,
    rawContent,
    metadata,
    content: body,
    contentType,
  };
}

/** Backwards-compatible wrapper for markdown-only parsing. */
export function parseMarkdown(options: {
  path: string;
  fileName: string;
  rawContent: string;
}): ParsedDocument {
  return parseDocument({
    path: options.path,
    fileName: options.fileName,
    rawContent: options.rawContent,
    contentType: "markdown",
  });
}

/** Splits raw content into an optional frontmatter block and the body. */
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
function resolveCategory(raw: string | undefined, filePath: string | null): KnowledgeCategory {
  const fromFrontmatter = normalizeCategory(raw);
  if (fromFrontmatter) return fromFrontmatter;

  if (filePath) {
    const folderName = containingFolder(filePath);
    const fromFolder = normalizeCategory(folderName);
    if (fromFolder) return fromFolder;
  }

  logError("Knowledge document has an unknown category", {
    path: filePath,
    rawCategory: raw ?? null,
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

/** Resolves a language code, defaulting to "en" for unknown values. */
function resolveLanguage(raw: string | undefined): KnowledgeLanguage {
  if (!raw) return "en";
  const normalized = raw.trim().toLowerCase();
  if (KNOWLEDGE_LANGUAGES.includes(normalized as KnowledgeLanguage)) {
    return normalized as KnowledgeLanguage;
  }
  return "en";
}

/** Parses a comma-separated tag list into a clean string array. */
function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

/** Parses a date string into a Date, or null when invalid. */
function parseDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const date = new Date(raw.trim());
  return Number.isNaN(date.getTime()) ? null : date;
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