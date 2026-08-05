import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { extractTextFromBuffer } from "@/lib/fileProcessing";
import { parseDocument } from "@/lib/knowledge/parser";
import { ingestParsedDocument } from "@/lib/knowledge/ingest";
import { contentTypeFromFileName } from "@/lib/knowledge/loader";
import { logError } from "@/lib/logger";

/**
 * Admin Knowledge Upload API (Phase 9).
 *
 * POST /api/admin/knowledge/upload -> upload one or more documents
 *
 * Accepts multipart/form-data with a `files` field containing one or more
 * files. Supports Markdown, PDF, DOCX, TXT, and HTML. Each file is parsed,
 * chunked, embedded, and persisted via the existing ingestion pipeline.
 *
 * All endpoints require an authenticated session.
 */

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ success: false, error: "No files provided" }, { status: 400 });
    }

    const results: { fileName: string; outcome: string }[] = [];
    let uploaded = 0;
    let failed = 0;

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = file.name;
        const contentType = contentTypeFromFileName(fileName);

        // Extract text from binary formats (PDF, DOCX); use raw text for others.
        let rawContent: string;
        if (contentType === "pdf" || contentType === "docx") {
          rawContent = await extractTextFromBuffer(buffer, fileName, file.type);
        } else {
          rawContent = buffer.toString("utf-8");
        }

        const parsed = parseDocument({
          path: null,
          fileName,
          rawContent,
          contentType,
        });

        const outcome = await ingestParsedDocument(parsed);
        results.push({ fileName, outcome });
        if (outcome === "created" || outcome === "updated") {
          uploaded++;
        } else if (outcome === "failed") {
          failed++;
        }
      } catch (error) {
        failed++;
        results.push({
          fileName: file.name,
          outcome: "failed",
        });
        logError("Knowledge upload failed for file", {
          fileName: file.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      uploaded,
      failed,
      results,
    });
  } catch (error) {
    logError("Knowledge upload failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 });
  }
}