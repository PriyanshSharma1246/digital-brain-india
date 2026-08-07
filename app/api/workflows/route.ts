import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner") ?? undefined;

  const where = owner ? { ownerId: owner } : undefined;
  const items = await prisma.workflow.findMany({ where, include: { nodes: true, edges: true } });
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const { name, description, nodes, edges } = body;
    if (!name || typeof name !== "string") return NextResponse.json({ success: false, error: "Missing name" }, { status: 400 });

    const wf = await prisma.workflow.create({
      data: {
        name,
        description: description ?? "",
        ownerId: session.user.id,
        nodes: { create: nodes ?? [] },
        edges: { create: edges ?? [] },
      },
      include: { nodes: true, edges: true },
    });

    return NextResponse.json({ success: true, workflow: wf });
  } catch (err) {
    logError("Workflow creation failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: "Unable to create workflow" }, { status: 500 });
  }
}
