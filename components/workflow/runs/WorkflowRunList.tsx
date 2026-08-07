"use client";

import { History } from "lucide-react";
import type { WorkflowRun } from "./types";
import RunStatusBadge from "./RunStatusBadge";
import { formatDateTime, formatDuration } from "./types";

type Props = {
  runs: WorkflowRun[];
  selectedRunId: string | null;
  onSelect: (runId: string) => void;
};

/**
 * Execution history list. Each row shows run number, status badge, started /
 * completed time and duration. Clicking a row selects it for detail views.
 */
export default function WorkflowRunList({ runs, selectedRunId, onSelect }: Props) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
        <History size={28} className="mb-3 text-slate-600" />
        <p className="text-sm font-medium text-slate-300">No executions yet</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
          Run this workflow once to see execution history, status, timeline and logs here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Execution History
      </div>
      <ul className="divide-y divide-slate-800/80">
        {runs.map((run, index) => {
          const isSelected = run.id === selectedRunId;
          const runNumber = runs.length - index;
          return (
            <li key={run.id}>
              <button
                type="button"
                onClick={() => onSelect(run.id)}
                className={`w-full px-4 py-3 text-left transition hover:bg-slate-800/50 ${
                  isSelected ? "bg-slate-800/70" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-sm font-semibold text-slate-200">Run #{runNumber}</span>
                  <RunStatusBadge status={run.status} />
                  {run.error && (
                    <span className="truncate text-xs text-red-300/80" title={run.error}>
                      {run.error}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                  <span>Started {formatDateTime(run.startedAt)}</span>
                  <span>Completed {formatDateTime(run.finishedAt)}</span>
                  <span>Duration {formatDuration(run.executionTime)}</span>
                  {typeof run.tokensUsed === "number" && run.tokensUsed > 0 && (
                    <span>{run.tokensUsed.toLocaleString()} tokens</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
