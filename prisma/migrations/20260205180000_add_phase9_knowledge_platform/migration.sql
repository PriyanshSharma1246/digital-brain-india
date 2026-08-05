-- Phase 9: Production Knowledge Base
-- Extends KnowledgeDocument with full metadata, adds chunk heading hierarchy,
-- document versions, ingestion jobs, search analytics, and quality checks.

-- AlterTable: KnowledgeDocument (add metadata columns)
ALTER TABLE "KnowledgeDocument" ADD COLUMN "description" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "subcategory" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "state" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "ministry" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "KnowledgeDocument" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "publishedAt" TIMESTAMP(3);
ALTER TABLE "KnowledgeDocument" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "KnowledgeDocument" ADD COLUMN "version" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "checksum" TEXT;
ALTER TABLE "KnowledgeDocument" ADD COLUMN "contentType" TEXT NOT NULL DEFAULT 'markdown';
ALTER TABLE "KnowledgeDocument" ADD COLUMN "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex: KnowledgeDocument metadata indexes
CREATE INDEX "KnowledgeDocument_category_idx" ON "KnowledgeDocument"("category");
CREATE INDEX "KnowledgeDocument_state_idx" ON "KnowledgeDocument"("state");
CREATE INDEX "KnowledgeDocument_ministry_idx" ON "KnowledgeDocument"("ministry");
CREATE INDEX "KnowledgeDocument_language_idx" ON "KnowledgeDocument"("language");
CREATE INDEX "KnowledgeDocument_updatedAt_idx" ON "KnowledgeDocument"("updatedAt");
CREATE UNIQUE INDEX "KnowledgeDocument_checksum_key" ON "KnowledgeDocument"("checksum");

-- AlterTable: KnowledgeChunk (add heading hierarchy + table preservation)
ALTER TABLE "KnowledgeChunk" ADD COLUMN "headingPath" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "KnowledgeChunk" ADD COLUMN "heading" TEXT;
ALTER TABLE "KnowledgeChunk" ADD COLUMN "hasTable" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex: KnowledgeChunk composite index
CREATE INDEX "KnowledgeChunk_documentId_chunkIndex_idx" ON "KnowledgeChunk"("documentId", "chunkIndex");

-- CreateTable: DocumentVersion
CREATE TABLE "DocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "checksum" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: DocumentVersion
CREATE INDEX "DocumentVersion_documentId_createdAt_idx" ON "DocumentVersion"("documentId", "createdAt");

-- AddForeignKey: DocumentVersion
ALTER TABLE "DocumentVersion" ADD CONSTRAINT "DocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: IngestionJob
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "processedItems" INTEGER NOT NULL DEFAULT 0,
    "succeededItems" INTEGER NOT NULL DEFAULT 0,
    "failedItems" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IngestionJob
CREATE INDEX "IngestionJob_status_createdAt_idx" ON "IngestionJob"("status", "createdAt");

-- CreateTable: IngestionJobDocument
CREATE TABLE "IngestionJobDocument" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "IngestionJobDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IngestionJobDocument
CREATE INDEX "IngestionJobDocument_jobId_status_idx" ON "IngestionJobDocument"("jobId", "status");

-- AddForeignKey: IngestionJobDocument
ALTER TABLE "IngestionJobDocument" ADD CONSTRAINT "IngestionJobDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: IngestionJobDocument
ALTER TABLE "IngestionJobDocument" ADD CONSTRAINT "IngestionJobDocument_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: IngestionLog
CREATE TABLE "IngestionLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "documentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IngestionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: IngestionLog
CREATE INDEX "IngestionLog_jobId_createdAt_idx" ON "IngestionLog"("jobId", "createdAt");

-- AddForeignKey: IngestionLog
ALTER TABLE "IngestionLog" ADD CONSTRAINT "IngestionLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "IngestionJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: SearchEvent
CREATE TABLE "SearchEvent" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "filters" JSONB,
    "resultCount" INTEGER NOT NULL,
    "usedEmbeddings" BOOLEAN NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: SearchEvent
CREATE INDEX "SearchEvent_createdAt_idx" ON "SearchEvent"("createdAt");
CREATE INDEX "SearchEvent_query_idx" ON "SearchEvent"("query");
CREATE INDEX "SearchEvent_success_idx" ON "SearchEvent"("success");

-- CreateTable: QualityCheckResult
CREATE TABLE "QualityCheckResult" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "checkType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityCheckResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: QualityCheckResult
CREATE INDEX "QualityCheckResult_documentId_checkType_idx" ON "QualityCheckResult"("documentId", "checkType");

-- AddForeignKey: QualityCheckResult
ALTER TABLE "QualityCheckResult" ADD CONSTRAINT "QualityCheckResult_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "KnowledgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
</content>
<task_progress>
- [x] Explore existing architecture (schema, knowledge libs, admin dashboard)
- [x] Design Phase 9 schema changes (metadata, jobs, analytics, versions)
- [ ] Implement metadata system & enhanced chunking
- [ ] Implement rich search with filters
- [ ] Implement citation improvements
- [ ] Implement knowledge dashboard extensions
- [ ] Implement background jobs & queue
- [ ] Implement duplicate detection
- [ ] Implement quality checks
- [ ] Implement analytics
- [ ] Run npm run build & npx tsc --noEmit until passing
- [ ] Provide final summary
</task_progress>
</｜DSML｜>
Now let me update the knowledge types with the full Phase 9 metadata system.

<write_to_file>
<path>lib/knowledge/types.ts</path>
<content>
/**
 * Shared type definitions for the knowledge ingestion pipeline.
 *
 * These types describe the flow:
 *   Source file -> ParsedDocument (loader/parser) -> split chunks (splitter)
 *   -> KnowledgeDocument / KnowledgeChunk records (ingestion service).
 *
 * Phase 9 extends the pipeline with:
 *   - Multi-format import (markdown, pdf, docx, txt, html)
 *   - Full metadata system (title, description, category, subcategory, state,
 *     ministry, language, source URL, dates, tags, version, checksum)
 *   - Enhanced chunking (heading hierarchy, table preservation, configurable
 *     chunk size / overlap)
 *   - Rich search filters (category, state, language, ministry, tag, date)
 *   - Citation metadata (heading, source URL, chunk number, confidence)
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

/** Supported source file formats. */
export const KNOWLEDGE_CONTENT_TYPES = [
  "markdown",
  "pdf",
  "docx",
  "txt",
  "html",
] as const;

export type KnowledgeContentType = (typeof KNOWLEDGE_CONTENT_TYPES)[number];

/** Supported languages (ISO 639-1 codes). */
export const KNOWLEDGE_LANGUAGES = ["en", "hi", "ta", "te", "bn", "mr", "gu", "kn", "ml", "pa"] as const;

export type KnowledgeLanguage = (typeof KNOWLEDGE_LANGUAGES)[number];

/** Full metadata extracted from a document (frontmatter, upload form, or file). */
export interface DocumentMetadata {
  /** Document title. Falls back to the file name when absent. */
  title: string;
  /** Short summary of the document. */
  description?: string | null;
  /** Canonical category (e.g. "agriculture"). */
  category: KnowledgeCategory;
  /** Optional sub-category refinement. */
  subcategory?: string | null;
  /** Indian state the document applies to (null when nationwide). */
  state?: string | null;
  /** Owning ministry / department. */
  ministry?: string | null;
  /** Document language code. */
  language: KnowledgeLanguage;
  /** Origin/source of the document, e.g. "Ministry of Agriculture". */
  source: string;
  /** Canonical web URL of the source document. */
  sourceUrl?: string | null;
  /** Date the document was published. */
  publishedAt?: Date | null;
  /** Tags for filtering and discovery. */
  tags: string[];
  /** User-visible document version (e.g. "1.2.0"). */
  version?: string | null;
}

/** A source file that has been read from disk or uploaded. */
export interface ParsedDocument {
  /** Absolute path of the source file (null for in-memory uploads). */
  path: string | null;
  /** File name (base name with extension). */
  fileName: string;
  /** Raw file contents (before frontmatter stripping). */
  rawContent: string;
  /** Metadata extracted from frontmatter and/or the file name. */
  metadata: DocumentMetadata;
  /** Document body with frontmatter removed. */
  content: string;
  /** Source format. */
  contentType: KnowledgeContentType;
}

/** Backwards-compatible alias for the markdown-only parsed shape. */
export interface ParsedMarkdown extends ParsedDocument {
  contentType: "markdown";
}

/** A single chunk produced by the splitter. */
export interface Chunk {
  /** Zero-based index of the chunk within the document. */
  index: number;
  /** Chunk text content. */
  content: string;
  /** Heading hierarchy leading to this chunk (e.g. ["Overview", "Eligibility"]). */
  headingPath: string[];
  /** The immediate heading for this chunk (null for intro text). */
  heading: string | null;
  /** True when the chunk contains table content that was kept together. */
  hasTable: boolean;
}

/** A chunked document ready for persistence. */
export interface ChunkedDocument {
  document: {
    title: string;
    description: string | null;
    category: KnowledgeCategory;
    subcategory: string | null;
    state: string | null;
    ministry: string | null;
    language: KnowledgeLanguage;
    source: string;
    sourceUrl: string | null;
    publishedAt: Date | null;
    tags: string[];
    version: string | null;
    checksum: string;
    content: string;
    contentType: KnowledgeContentType;
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

/** Filters for rich retrieval (Phase 9). */
export interface SearchFilters {
  /** Restrict to a single category. */
  category?: string;
  /** Restrict to a set of categories. */
  categories?: string[];
  /** Restrict to a single Indian state. */
  state?: string;
  /** Restrict to a single language code. */
  language?: string;
  /** Restrict to a single ministry. */
  ministry?: string;
  /** Restrict to documents containing any of these tags. */
  tags?: string[];
  /** Only documents published on or after this date. */
  publishedAfter?: Date;
  /** Only documents published on or before this date. */
  publishedBefore?: Date;
}

/** A retrieved chunk with full citation metadata (Phase 9). */
export interface Citation {
  /** Source document title. */
  documentTitle: string;
  /** Heading under which the chunk appears. */
  heading: string | null;
  /** Canonical source URL (null when not tracked). */
  sourceUrl: string | null;
  /** Zero-based chunk number within the document. */
  chunkNumber: number;
  /** Relevance confidence score (0–1). */
  confidence: number;
}