import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createId } from "@/lib/chatStorage";
import { encodeFileEntry } from "@/lib/chatPersistence";
import { saveUploadedFile, extractTextFromBuffer } from "@/lib/fileProcessing";
import { sanitizeTextInput, validateUploadFile } from "@/lib/sanitize";
import { logError } from "@/lib/logger";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".csv"];
const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;
const recentRequests = new Map<string, number[]>();

// Note: extension extraction not required here; validation uses file.name inside validateUploadFile

function isRateLimited(userId: string) {
  const now = Date.now();
  const timestamps = recentRequests.get(userId) ?? [];
  const recent = timestamps.filter((stamp) => now - stamp < RATE_LIMIT_WINDOW_MS);
  recentRequests.set(userId, recent);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    return true;
  }
  recent.push(now);
  return false;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  if (isRateLimited(session.user.id)) {
    return NextResponse.json({ success: false, error: "Too many upload requests. Please try again shortly." }, { status: 429 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data")) {
    return NextResponse.json({ success: false, error: "Invalid content type" }, { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const conversationId = formData.get("conversationId")?.toString();

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ success: false, error: "No file uploaded" }, { status: 400 });
  }

  const fileName = sanitizeTextInput(file.name, { maxLength: 120 });
  const validation = validateUploadFile(file, ALLOWED_EXTENSIONS, MAX_UPLOAD_SIZE_BYTES);
  if (!validation.ok) {
    return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
  }

  const knownConversation = typeof conversationId === "string" && conversationId ? conversationId : `conv:${createId()}`;
  const data = new Uint8Array(await file.arrayBuffer());

  await saveUploadedFile(session.user.id, fileName, data);

  let extractedText = "";
  try {
    extractedText = await extractTextFromBuffer(Buffer.from(data), fileName, file.type);
  } catch (error) {
    logError("Failed to extract uploaded file content", { userId: session.user.id, fileName, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: "Failed to extract file content" }, { status: 500 });
  }

  const encodedFile = encodeFileEntry(knownConversation, fileName, extractedText);

  try {
    await prisma.chat.create({
      data: {
        message: encodedFile,
        reply: `Uploaded and processed ${fileName}. Ask me questions about this file.`,
        userId: session.user.id,
      },
    });
  } catch (error) {
    logError("Failed to persist uploaded file entry", { userId: session.user.id, fileName, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: "Unable to save upload history" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    fileName,
    conversationId: knownConversation,
    message: `Uploaded ${fileName}`,
  });
}
