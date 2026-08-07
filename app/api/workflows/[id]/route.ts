import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logError } from "@/lib/logger";

/** Payload shape for a workflow node coming from the update request body. */
type WorkflowNodeInput = {
  id: string;
  type: string;
  name?: string | null;
  positionX?: number;
  positionY?: number;
  configuration?: unknown;
};

/** Payload shape for a workflow edge coming from the update request body. */
type WorkflowEdgeInput = {
  id: string;
  sourceNode: string;
  targetNode: string;
  condition?: string | null;
};

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop();
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  const wf = await prisma.workflow.findUnique({ where: { id }, include: { nodes: true, edges: true } });
  if (!wf) return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, workflow: wf });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop();
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  try {
    const body = await req.json();
    const {
      name,
      description,
      nodes,
      edges,
      status,
    } = body as {
      name?: string;
      description?: string | null;
      status?: string;
      nodes?: WorkflowNodeInput[];
      edges?: WorkflowEdgeInput[];
    };

    // Update workflow record
    await prisma.workflow.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        status: status ?? undefined,
      },
    });

    // Upsert nodes/edges: simple strategy - delete existing and recreate when arrays provided
    if (Array.isArray(nodes)) {
      await prisma.workflowNode.deleteMany({ where: { workflowId: id } });
      if (nodes.length > 0) {
        await prisma.workflowNode.createMany({
          data: nodes.map((n) => ({
            id: n.id,
            workflowId: id,
            type: n.type,
            name: n.name ?? null,
            positionX: n.positionX ?? 0,
            positionY: n.positionY ?? 0,
            configuration:
              n.configuration == null
                ? undefined
                : JSON.parse(JSON.stringify(n.configuration)),
          })),
        });
      }
    }

    if (Array.isArray(edges)) {
      await prisma.workflowEdge.deleteMany({ where: { workflowId: id } });
      if (edges.length > 0) {
        await prisma.workflowEdge.createMany({
          data: edges.map((e) => ({
            id: e.id,
            workflowId: id,
            sourceNode: e.sourceNode,
            targetNode: e.targetNode,
            condition: e.condition ?? null,
          })),
        });
      }
    }

    const updated = await prisma.workflow.findUnique({ where: { id }, include: { nodes: true, edges: true } });
    return NextResponse.json({ success: true, workflow: updated });
  } catch (err) {
    logError("Workflow update failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: "Unable to update workflow" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.pathname.split("/").pop();
  if (!id) return NextResponse.json({ success: false, error: "Missing id" }, { status: 400 });

  try {
    await prisma.workflow.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    logError("Workflow deletion failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: "Unable to delete workflow" }, { status: 500 });
  }
}
