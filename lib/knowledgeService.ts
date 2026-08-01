import { prisma } from "@/lib/prisma";
import { INDIAN_KNOWLEDGE_BASE } from "@/data/indianKnowledge";
import { extractTextFromBuffer } from "@/lib/fileProcessing";
import { Buffer } from "buffer";

export type KnowledgeEntryRecord = {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  tags: string[];
  fileName?: string | null;
  fileType?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function normalizeTags(tags: string[] | string | undefined) {
  if (Array.isArray(tags)) return tags.map((tag) => tag.trim()).filter(Boolean);
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  return [];
}

export async function seedKnowledgeBase() {
  const count = await prisma.knowledgeEntry.count();
  if (count > 0) return;

  await prisma.knowledgeEntry.createMany({
    data: INDIAN_KNOWLEDGE_BASE.map((item) => ({
      title: item.title,
      content: item.content,
      category: item.topic,
      source: item.source,
      tags: [item.topic],
    })),
  });
}

export async function listKnowledgeEntries(search = "") {
  const where = search
    ? {
        OR: [
          { title: { contains: search, mode: "insensitive" as const } },
          { content: { contains: search, mode: "insensitive" as const } },
          { category: { contains: search, mode: "insensitive" as const } },
          { source: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  return prisma.knowledgeEntry.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });
}

export async function createKnowledgeEntry(input: {
  title: string;
  content: string;
  category: string;
  source: string;
  tags?: string[] | string;
  fileName?: string | null;
  fileType?: string | null;
}) {
  return prisma.knowledgeEntry.create({
    data: {
      title: input.title,
      content: input.content,
      category: input.category,
      source: input.source,
      tags: normalizeTags(input.tags),
      fileName: input.fileName ?? null,
      fileType: input.fileType ?? null,
    },
  });
}

export async function updateKnowledgeEntry(id: string, input: Partial<{
  title: string;
  content: string;
  category: string;
  source: string;
  tags: string[] | string;
}>) {
  return prisma.knowledgeEntry.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.source !== undefined ? { source: input.source } : {}),
      ...(input.tags !== undefined ? { tags: normalizeTags(input.tags) } : {}),
    },
  });
}

export async function deleteKnowledgeEntry(id: string) {
  return prisma.knowledgeEntry.delete({ where: { id } });
}

export async function importKnowledgeFile(file: File, category: string, source: string, tags: string[]) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extracted = await extractTextFromBuffer(Buffer.from(bytes), file.name, file.type);

  return createKnowledgeEntry({
    title: file.name.replace(/\.[^/.]+$/, ""),
    content: extracted,
    category,
    source,
    tags,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
  });
}
