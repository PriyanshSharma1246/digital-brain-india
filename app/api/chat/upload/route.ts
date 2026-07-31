import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createId } from "@/lib/chatStorage";
import { encodeFileEntry } from "@/lib/chatPersistence";
import { saveUploadedFile, extractTextFromBuffer } from "@/lib/fileProcessing";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".csv"];

function getExtension(fileName: string) {
  return fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
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

  const fileName = file.name;
  const ext = getExtension(fileName);
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json({ success: false, error: "Unsupported file type" }, { status: 400 });
  }

  const knownConversation = typeof conversationId === "string" && conversationId ? conversationId : `conv:${createId()}`;
  const data = new Uint8Array(await file.arrayBuffer());

  await saveUploadedFile(session.user.id, fileName, data);

  let extractedText = "";
  try {
    extractedText = await extractTextFromBuffer(Buffer.from(data), fileName, file.type);
  } catch (error) {
    return NextResponse.json({ success: false, error: "Failed to extract file content" }, { status: 500 });
  }

  const encodedFile = encodeFileEntry(knownConversation, fileName, extractedText);

  await prisma.chat.create({
    data: {
      message: encodedFile,
      reply: `Uploaded and processed ${fileName}. Ask me questions about this file.`,
      userId: session.user.id,
    },
  });

  return NextResponse.json({
    success: true,
    fileName,
    conversationId: knownConversation,
    message: `Uploaded ${fileName}`,
  });
}
