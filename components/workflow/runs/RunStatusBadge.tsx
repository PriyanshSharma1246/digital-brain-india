"use client";

import type { RunStatus } from "./types";

type Props = {
  status: RunStatus;
  className?: string;
};

const STYLES: Record<RunStatus, { label: string; classes: string; dot: string; pulse?: boolean }> = {
  RUNNING: {
    label: "Running",
    classes: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    dot: "bg-amber-400",
    pulse: true,
  },
  COMPLETED: {
    label: "Completed",
    classes: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-400",
  },
  FAILED: {
    label: "Failed",
    classes: "bg-red-500/15 text-red-300 border-red-500/30",
    dot: "bg-red-400",
  },
  PENDING: {
    label: "Pending",
    classes: "bg-slate-500/15 text-slate-300 border-slate-600/40",
    dot: "bg-slate-500",
  },
};

/** Pill badge showing a workflow run status with a colored indicator dot. */
export default function RunStatusBadge({ status, className = "" }: Props) {
  const meta = STYLES[status] ?? STYLES.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${meta.classes} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${meta.pulse ? "animate-pulse" : ""}`}
      />
      {meta.label}
    </span>
  );
}
