"use client";

import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { ExecutionStep, StepStatus } from "./types";
import { formatDateTime, formatDuration, NODE_TYPE_LABEL } from "./types";

type Props = {
  steps: ExecutionStep[];
};

const STATUS_ICON: Record<StepStatus, { icon: typeof CheckCircle2; classes: string }> = {
  COMPLETED: { icon: CheckCircle2, classes: "text-emerald-400" },
  FAILED: { icon: XCircle, classes: "text-red-400" },
  RUNNING: { icon: Loader2, classes: "text-amber-400 animate-spin" },
  PENDING: { icon: Clock, classes: "text-slate-500" },
};

/**
 * Vertical node execution timeline. Each step shows status icon, node name,
 * type, start/end time, duration and any error message.
 */
export default function ExecutionTimeline({ steps }: Props) {
  if (steps.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center text-sm text-slate-500">
        Select a run to see its node execution timeline.
      </div>
    );
  }

  return (
    <ol className="relative ml-2 space-y-2 border-l border-slate-800 pl-5">
      {steps.map((step) => {
        const meta = STATUS_ICON[step.status] ?? STATUS_ICON.PENDING;
        const Icon = meta.icon;
        return (
          <li key={step.id} className="relative">
            <span
              className={`absolute -left-[27px] top-3 flex h-5 w-5 items-center justify-center rounded-full border border-slate-700 bg-slate-900 ${meta.classes}`}
            >
              <Icon size={13} />
            </span>

            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-100">{step.name}</span>
                <span className="rounded-md border border-slate-700 bg-slate-800/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
                  {step.status}
                </span>
                <span className="rounded-md bg-slate-800/40 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {NODE_TYPE_LABEL[step.type] ?? step.type}
                </span>
                {step.duration != null && step.duration >= 0 && (
                  <span className="ml-auto text-[11px] font-medium text-slate-400">
                    {formatDuration(step.duration)}
                  </span>
                )}
              </div>

              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-slate-500">
                <span>Start {formatDateTime(step.startedAt)}</span>
                <span>End {formatDateTime(step.finishedAt)}</span>
              </div>

              {step.error && (
                <p className="mt-2 whitespace-pre-wrap rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-300">
                  {step.error}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
