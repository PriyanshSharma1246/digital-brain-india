import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createIngestionJob,
  getJob,
  listJobs,
  retryFailedDocuments,
} from "@/lib/knowledge/jobs";
import { logError } from "@/lib/logger";

/**
 * Admin Knowledge Jobs API (Phase 9).
 *
 * GET    /api/admin/knowledge/jobs          -> list recent ingestion jobs
 * GET    /api/admin/knowledge/jobs?id=...   -> fetch a single job with logs
 * POST   /api/admin/knowledge/jobs          -> create a new ingestion job
 * POST   /api/admin/knowledge/jobs?action=retry&id=... -> retry failed documents
 *
 * All endpoints require an authenticated session.
 */

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const job = await getJob(id);
      if (!job) {
        return NextResponse.json({ success: false, error: "Job not found" }, { status: 404 });
      }
      return NextResponse.json({ success: true, job });
    }

    const jobs = await listJobs();
    return NextResponse.json({ success: true, jobs });
  } catch (error) {
    logError("Admin knowledge jobs list failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Unable to load jobs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const id = searchParams.get("id");

    // POST /api/admin/knowledge/jobs?action=retry&id=... -> retry failed documents
    if (action === "retry" && id) {
      const retried = await retryFailedDocuments(id);
      return NextResponse.json({ success: true, retried });
    }

    // POST /api/admin/knowledge/jobs -> create a new ingestion job
    const body = await req.json().catch(() => ({}));
    const type = body.type ?? "bulk";
    const documentIds: string[] = body.documentIds ?? [];

    const jobId = await createIngestionJob(type, documentIds);
    return NextResponse.json({ success: true, jobId });
  } catch (error) {
    logError("Admin knowledge job creation failed", {
      userId: session.user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ success: false, error: "Unable to create job" }, { status: 500 });
  }
}