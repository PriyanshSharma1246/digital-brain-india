import { NextResponse } from "next/server";
import { searchLiveWeb } from "@/lib/liveIntelligence";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q") ?? "";
  const result = await searchLiveWeb(query);
  return NextResponse.json(result);
}
