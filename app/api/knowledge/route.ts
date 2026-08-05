import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildKnowledgeContext, searchKnowledge } from "@/lib/rag";
import {
  createKnowledgeEntry,
  deleteKnowledgeEntry,
  importKnowledgeFile,
  listKnowledgeEntries,
  seedKnowledgeBase,
  updateKnowledgeEntry,
} from "@/lib/knowledgeService";
import { sanitizeTagInput, sanitizeTextInput } from "@/lib/sanitize";
import { logError } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  await seedKnowledgeBase();

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? searchParams.get("search") ?? "";

  if (query.trim()) {
    const items = await searchKnowledge(query, 5);
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        topic: item.topic,
        title: item.title,
        content: item.content,
        source: item.source,
        score: item.score,
      })),
      context: buildKnowledgeContext(query, 5),
      entries: await listKnowledgeEntries(query),
    });
  }

  return NextResponse.json({ entries: await listKnowledgeEntries(query) });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const title = sanitizeTextInput(formData.get("title")?.toString() ?? "", { maxLength: 160 });
  const content = sanitizeTextInput(formData.get("content")?.toString() ?? "", { maxLength: 20000, preserveLineBreaks: true });
  const category = sanitizeTextInput(formData.get("category")?.toString() ?? "Other", { maxLength: 80 });
  const source = sanitizeTextInput(formData.get("source")?.toString() ?? "User", { maxLength: 120 });
  const tags = sanitizeTagInput(formData.get("tags")?.toString() ?? "");

  try {
    if (file && file instanceof File) {
      const entry = await importKnowledgeFile(file, category, source, tags);
      return NextResponse.json({ success: true, entry });
    }

    if (!title.trim() || !content.trim()) {
      return NextResponse.json({ success: false, error: "Title and content are required" }, { status: 400 });
    }

    const entry = await createKnowledgeEntry({ title, content, category, source, tags });
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    logError("Knowledge entry creation failed", { userId: session.user.id, title, category, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: "Unable to save knowledge entry" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const id = formData.get("id")?.toString();
  const title = formData.get("title")?.toString() ? sanitizeTextInput(formData.get("title")?.toString() ?? "", { maxLength: 160 }) : undefined;
  const content = formData.get("content")?.toString() ? sanitizeTextInput(formData.get("content")?.toString() ?? "", { maxLength: 20000, preserveLineBreaks: true }) : undefined;
  const category = formData.get("category")?.toString() ? sanitizeTextInput(formData.get("category")?.toString() ?? "", { maxLength: 80 }) : undefined;
  const source = formData.get("source")?.toString() ? sanitizeTextInput(formData.get("source")?.toString() ?? "", { maxLength: 120 }) : undefined;
  const tags = formData.get("tags")?.toString() ? sanitizeTagInput(formData.get("tags")?.toString() ?? "") : undefined;

  if (!id) {
    return NextResponse.json({ success: false, error: "Missing knowledge id" }, { status: 400 });
  }

  try {
    const entry = await updateKnowledgeEntry(id, { title, content, category, source, tags });
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    logError("Knowledge entry update failed", { userId: session.user.id, id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: "Unable to update knowledge entry" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing knowledge id" }, { status: 400 });
  }

  try {
    await deleteKnowledgeEntry(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    logError("Knowledge entry deletion failed", { userId: session.user.id, id, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json({ success: false, error: "Unable to delete knowledge entry" }, { status: 500 });
  }
}
