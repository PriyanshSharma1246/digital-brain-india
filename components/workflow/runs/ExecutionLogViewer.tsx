"use client";

import { TerminalSquare } from "lucide-react";
import type { ExecutionLog, LogLevel } from "./types";

type Props = {
  logs: ExecutionLog[];
};

const LEVEL_STYLES: Record<LogLevel, { label: string; classes: string; badge: string }> = {
  info: { label: "INFO", classes: "text-slate-300", badge: "bg-sky-500/15 text-sky-300 border-sky-500/30" },
  warn: { label: "WARN", classes: "text-amber-300", badge: "bg-amber-500/15 text-amber-300 border-amber-500/30" },
  error: { label: "ERROR", classes: "text-red-300", badge: "bg-red-500/15 text-red-300 border-red-500/30" },
  debug: { label: "DEBUG", classes: "text-slate-400", badge: "bg-slate-500/15 text-slate-300 border-slate-600/40" },
};

function formatTs(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

/**
 * Execution log viewer. Renders each log entry with timestamp, level badge,
 * message and optional metadata (agent / RAG / tool responses are attached as
 * JSON metadata by the engine).
 */
export default function ExecutionLogViewer({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-10 text-center text-sm text-slate-500">
        No logs for this run.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <TerminalSquare size={14} />
        Execution Logs
      </div>
      <div className="max-h-[480px] overflow-y-auto font-mono text-xs">
        {logs.map((log) => {
          const meta = LEVEL_STYLES[log.level] ?? LEVEL_STYLES.info;
          const hasMeta = log.metadata != null && Object.keys(log.metadata).length > 0;
          return (
            <div
              key={log.id}
              className="border-b border-slate-800/60 px-4 py-2.5 last:border-b-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] text-slate-600">{formatTs(log.timestamp)}</span>
                <span
                  className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${meta.badge}`}
                >
                  {meta.label}
                </span>
              </div>
              <p className={`mt-0.5 whitespace-pre-wrap leading-relaxed ${meta.classes}`}>
                {log.message}
              </p>
              {hasMeta && (
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-slate-950/70 px-3 py-2 leading-relaxed text-slate-400">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
