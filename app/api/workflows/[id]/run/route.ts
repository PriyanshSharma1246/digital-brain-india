import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { executeWorkflow, listWorkflowRuns, getWorkflowRun } from "@/lib/workflow/engine";
import { logError } from "@/lib/logger";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const id = url.pathname.split("/").slice(-2, -1)[0];
  if (!id) return NextResponse.json({ success: false, error: "Missing workflow id" }, { status: 400 });

  const runId = url.searchParams.get("runId");
  if (runId) {
    const run = await getWorkflowRun(runId);
    if (!run) return NextResponse.json({ success: false, error: "Run not found" }, { status: 404 });
    return NextResponse.json({ success: true, run });
  }

  const runs = await listWorkflowRuns(id);
  return NextResponse.json({ success: true, runs });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const parts = url.pathname.split("/");
  const id = parts[parts.length - 2]; // /api/workflows/[id]/run
  if (!id) return NextResponse.json({ success: false, error: "Missing workflow id" }, { status: 400 });

  try {
    const body = await req.json().catch(() => ({}));
    const input = body.input ?? undefined;
    const result = await executeWorkflow(id, session.user.id, input);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    logError("Workflow run failed", { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ success: false, error: "Unable to run workflow" }, { status: 500 });
  }
}
