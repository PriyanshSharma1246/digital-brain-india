import fs from "fs/promises";
import path from "path";
import os from "os";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { parse } from "csv-parse/sync";

const MAX_EXTRACTED_TEXT_LENGTH = 20000;

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_+/g, "_");
}

export function getUploadDirectory(userId: string) {
  return path.join(os.tmpdir(), "digital-brain-india-uploads", userId);
}

export async function saveUploadedFile(userId: string, fileName: string, data: Uint8Array) {
  const uploadDir = getUploadDirectory(userId);
  await fs.mkdir(uploadDir, { recursive: true });
  const safeName = `${Date.now()}-${sanitizeFileName(fileName)}`;
  const filePath = path.join(uploadDir, safeName);
  await fs.writeFile(filePath, data);
  return filePath;
}

function truncateText(text: string) {
  if (text.length <= MAX_EXTRACTED_TEXT_LENGTH) return text;
  return `${text.slice(0, MAX_EXTRACTED_TEXT_LENGTH)}\n\n[Truncated file content]`;
}

export async function extractTextFromBuffer(
  buffer: Buffer,
  fileName: string,
  mimeType: string
) {
  const lowerName = fileName.toLowerCase();
  const normalizedMime = mimeType.toLowerCase();
  if (lowerName.endsWith(".pdf") || normalizedMime === "application/pdf") {
    const parseResult = await new PDFParse(buffer).getText();
    return truncateText(parseResult.text || "");
  }

  if (lowerName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return truncateText(result.value || "");
  }

  if (lowerName.endsWith(".csv")) {
    const text = buffer.toString("utf-8");
    const rows = parse(text, {
      relax_column_count: true,
      skip_empty_lines: true,
    }) as Array<Array<unknown>>;
    const formatted = rows
      .map((row) => row.map((cell) => String(cell ?? "")).join(", "))
      .join("\n");
    return truncateText(formatted);
  }

  if (lowerName.endsWith(".txt")) {
    return truncateText(buffer.toString("utf-8"));
  }

  throw new Error(`Unsupported file type: ${fileName} (${normalizedMime})`);
}
