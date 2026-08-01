import { NextResponse } from "next/server";
import { buildKnowledgeContext, searchKnowledge } from "@/lib/rag";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json({ items: [] });
  }

  const items = searchKnowledge(query, 5);
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
  });
}
