"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, RefreshCw } from "lucide-react";
import type { ExecutionLog, RunNodeMeta, WorkflowRun } from "./types";
import { deriveSteps, formatDateTime, formatDuration, normalizeLevel, normalizeStatus } from "./types";
import WorkflowRunList from "./WorkflowRunList";
import ExecutionTimeline from "./ExecutionTimeline";
import ExecutionLogViewer from "./ExecutionLogViewer";
import RunStatusBadge from "./RunStatusBadge";

type RawLog = {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

type RawRun = {
  id: string;
  workflowId: string;
  status: string;
  startedAt: string;
  finishedAt?: string | null;
  input?: unknown;
  output?: unknown;
  tokensUsed?: number;
  executionTime?: number | null;
  error?: string | null;
  logs?: RawLog[];
};

function mapRun(raw: RawRun): WorkflowRun {
  const logs: ExecutionLog[] = (raw.logs ?? []).map((l) => ({
    id: l.id,
    timestamp: l.timestamp,
    level: normalizeLevel(l.level),
    message: l.message,
    metadata: l.metadata ?? null,
  }));
  return {
    id: raw.id,
    workflowId: raw.workflowId,
    status: normalizeStatus(raw.status),
    startedAt: raw.startedAt,
    finishedAt: raw.finishedAt ?? null,
    input: raw.input ?? undefined,
    output: raw.output ?? undefined,
    tokensUsed: raw.tokensUsed ?? 0,
    executionTime: raw.executionTime ?? null,
    error: raw.error ?? null,
    logs,
  };
}

type NoticeKind = "success" | "error";
type Notice = { kind: NoticeKind; text: string } | null;

export default function WorkflowRunsDashboard({ workflowId }: { workflowId: string }) {
  const [workflow, setWorkflow] = useState<{ id: string; name: string; nodes: RunNodeMeta[] } | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null);
  const [running, setRunning] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const runsRef = useRef<WorkflowRun[]>([]);

  const setNoticeSoon = useCallback((kind: NoticeKind, text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  // Keep a ref in sync so async handlers can read the latest list.
  const commitRuns = useCallback((next: WorkflowRun[]) => {
    runsRef.current = next;
    setRuns(next);
  }, []);

  const loadRunDetails = useCallback(
    async (run: WorkflowRun) => {
      setSelectedRunId(run.id);
      setSelectedRun(run);
      setLoadingRun(true);
      try {
        const res = await fetch(
          `/api/workflows/${workflowId}/run?runId=${encodeURIComponent(run.id)}`
        );
        const json = await res.json();
        if (res.ok && json.success && json.run) {
          setSelectedRun(mapRun(json.run as RawRun));
        }
      } catch {
        // Keep the list version; details API may be unavailable.
      } finally {
        setLoadingRun(false);
      }
    },
    [workflowId]
  );

  const refreshRuns = useCallback(
    async (selectRunId?: string) => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}/run`);
        const json = await res.json();
        if (res.ok && json.success && Array.isArray(json.runs)) {
          const mapped = (json.runs as RawRun[]).map(mapRun);
          commitRuns(mapped);
          const existing = selectRunId ?? selectedRunId;
          const target =
            (existing && mapped.some((r) => r.id === existing) && existing) ||
            mapped[0]?.id ||
            null;
          setSelectedRunId(target);
          const run = target ? mapped.find((r) => r.id === target) ?? null : null;
          if (run) await loadRunDetails(run);
          return;
        }
        setNoticeSoon("error", json.error ?? "Failed to load executions");
      } catch {
        setNoticeSoon("error", "Executions are unavailable right now");
      }
    },
    [workflowId, selectedRunId, commitRuns, loadRunDetails, setNoticeSoon]
  );

  const loadInitial = useCallback(async () => {
    // Workflow metadata.
    try {
      const wRes = await fetch(`/api/workflows/${workflowId}`);
      const wJson = await wRes.json();
      if (wRes.ok && wJson.success && wJson.workflow) {
        setWorkflow({
          id: wJson.workflow.id,
          name: wJson.workflow.name,
          nodes: (wJson.workflow.nodes ?? []).map((n: { id: string; name?: string | null; type: string }) => ({
            id: n.id,
            name: n.name ?? null,
            type: n.type,
          })),
        });
      }
    } catch {
      // Workflow may be unavailable; the dashboard still renders gracefully.
    }
    await refreshRuns();
  }, [workflowId, refreshRuns]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadInitial();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRun = useCallback(async () => {
    setRunning(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: {} }),
      });
      const json = await res.json();
      if (json.success && json.result?.runId) {
        setNoticeSoon("success", "Workflow run completed successfully");
        await refreshRuns(json.result.runId as string);
      } else {
        setNoticeSoon(
          "error",
          (json.error as string) ?? (json.result?.error as string) ?? "Workflow run failed"
        );
        await refreshRuns();
      }
    } catch {
      setNoticeSoon("error", "Unable to run the workflow right now");
    } finally {
      setRunning(false);
    }
  }, [workflowId, refreshRuns, setNoticeSoon]);

  const steps = selectedRun ? deriveSteps(selectedRun, workflow?.nodes ?? []) : [];
  const selectedIndex = selectedRunId ? runs.findIndex((r) => r.id === selectedRunId) : -1;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 bg-slate-900/60 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Workflow Execution
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-slate-50">
            {workflow?.name ?? "Workflow"}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {running ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <Play size={15} />
            )}
            {running ? "Running…" : "Run Workflow"}
          </button>
          <Link
            href={`/workflows/builder?id=${encodeURIComponent(workflowId)}`}
            className="flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-800"
          >
            <ArrowLeft size={15} />
            Back
          </Link>
        </div>
      </header>

      {notice && (
        <div
          className={`border-b px-6 py-3 text-sm font-medium ${
            notice.kind === "success"
              ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-300"
              : "border-red-800/50 bg-red-950/40 text-red-300"
          }`}
        >
          {notice.text}
        </div>
      )}

      <main className="flex-1 p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <WorkflowRunList
              runs={runs}
              selectedRunId={selectedRunId}
              onSelect={(id) => {
                const run = runsRef.current.find((r) => r.id === id);
                if (run) void loadRunDetails(run);
              }}
            />
            {runs.length > 0 && (
              <button
                type="button"
                onClick={() => void refreshRuns()}
                className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-400 transition hover:text-slate-200"
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            )}
          </section>

          <section className="space-y-6">
            {selectedRun ? (
              <>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-semibold">
                      {selectedIndex >= 0 ? `Run #${runs.length - selectedIndex}` : "Run"}
                    </span>
                    <RunStatusBadge status={selectedRun.status} />
                    {loadingRun && (
                      <RefreshCw size={13} className="animate-spin text-slate-500" />
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                    <span>Started {formatDateTime(selectedRun.startedAt)}</span>
                    <span>Completed {formatDateTime(selectedRun.finishedAt)}</span>
                    <span>Duration {formatDuration(selectedRun.executionTime)}</span>
                    {typeof selectedRun.tokensUsed === "number" && selectedRun.tokensUsed > 0 && (
                      <span>{selectedRun.tokensUsed.toLocaleString()} tokens</span>
                    )}
                  </div>
                  {selectedRun.error && (
                    <p className="mt-3 whitespace-pre-wrap rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-300">
                      {selectedRun.error}
                    </p>
                  )}
                </div>

                <div>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Timeline
                  </h2>
                  <ExecutionTimeline steps={steps} />
                </div>

                <div>
                  <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                    Logs
                  </h2>
                  <ExecutionLogViewer logs={selectedRun.logs} />
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-16 text-center text-sm text-slate-500">
                Select a run from the history to view its timeline and logs.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

