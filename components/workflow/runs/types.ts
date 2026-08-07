/**
 * Phase 12.2 — Workflow Execution Dashboard shared types + helpers.
 *
 * Data shapes mirror the existing backend:
 *   GET /api/workflows/[id]        -> { success, workflow: { id, name, nodes, edges } }
 *   GET /api/workflows/[id]/run    -> { success, runs: WorkflowRun[] }       (history)
 *   GET /api/workflows/[id]/run?runId=  -> { success, run: WorkflowRun }     (details + logs)
 *   POST /api/workflows/[id]/run   -> { success, result: { runId, outputs, output, ... } }
 *
 * No `any` is used; all types are strict.
 */

/** Canonical run status as shown in the UI (normalized from the backend value). */
export type RunStatus = "RUNNING" | "COMPLETED" | "FAILED" | "PENDING";

/** Execution step status. */
export type StepStatus = "RUNNING" | "COMPLETED" | "FAILED" | "PENDING";

/** Log severity level. */
export type LogLevel = "info" | "warn" | "error" | "debug";

/** A persisted workflow execution (WorkflowRun model). */
export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string | null;
  input?: unknown;
  output?: unknown;
  tokensUsed?: number;
  executionTime?: number | null;
  error?: string | null;
  logs: ExecutionLog[];
}

/** A single node execution step shown on the timeline. */
export interface ExecutionStep {
  id: string;
  nodeId: string;
  name: string;
  type: string;
  status: StepStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  /** Duration in milliseconds when derivable, otherwise null. */
  duration?: number | null;
  error?: string | null;
}

/** A single execution log entry (WorkflowExecutionLog model). */
export interface ExecutionLog {
  id: string;
  timestamp: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, unknown> | null;
}

/** Minimal node info needed to render the timeline for a workflow. */
export interface RunNodeMeta {
  id: string;
  name?: string | null;
  type: string;
}

/** Maps a backend status string to the canonical UI status. */
export function normalizeStatus(raw: string | null | undefined): RunStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "running":
      return "RUNNING";
    case "completed":
    case "success":
    case "succeeded":
      return "COMPLETED";
    case "failed":
    case "error":
    case "cancelled":
    case "canceled":
      return "FAILED";
    default:
      return "PENDING";
  }
}

/** Maps a raw log level to the canonical type. */
export function normalizeLevel(raw: string | null | undefined): LogLevel {
  switch ((raw ?? "").toLowerCase()) {
    case "warn":
    case "warning":
      return "warn";
    case "error":
      return "error";
    case "debug":
      return "debug";
    default:
      return "info";
  }
}

/** Human-friendly label for a backend node type. */
export const NODE_TYPE_LABEL: Record<string, string> = {
  CHAT: "Trigger",
  LLM: "AI Agent",
  RAG: "RAG",
  CONNECTOR: "Tool",
  END: "Output",
  MEMORY: "Memory",
  CONDITION: "Condition",
};

export function displayNodeType(type: string | null | undefined): string {
  return NODE_TYPE_LABEL[type ?? ""] ?? type ?? "Node";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || Number.isNaN(ms) || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

function msBetween(a: string, b: string): number | null {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.max(0, db - da);
}

/**
 * Derives ordered execution steps for the timeline from a run's logs plus the
 * workflow's node metadata. Steps without any log entry are marked PENDING.
 * Status for a node with an error log is FAILED (carrying the error message).
 */
export function deriveSteps(run: WorkflowRun | null, nodes: RunNodeMeta[]): ExecutionStep[] {
  if (!run || nodes.length === 0) return [];

  const stamps = new Map<string, string[]>();
  const fail = new Map<string, string>();
  const done = new Set<string>();

  for (const log of run.logs ?? []) {
    const nodeId = log.metadata?.nodeId;
    if (typeof nodeId !== "string" || nodeId.length === 0) continue;

    const arr = stamps.get(nodeId) ?? [];
    arr.push(log.timestamp);
    stamps.set(nodeId, arr);

    if ((log.level === "error" || log.level === "warn") && !fail.has(nodeId)) {
      fail.set(nodeId, log.message);
    } else if (log.level === "info" && !fail.has(nodeId)) {
      done.add(nodeId);
    }
  }

  return nodes.map((n) => {
    const ts = stamps.get(n.id) ?? [];
    const startedAt = ts[0] ?? null;
    const finishedAt = ts[ts.length - 1] ?? null;
    const isFailed = fail.has(n.id);
    const status: StepStatus = isFailed ? "FAILED" : done.has(n.id) ? "COMPLETED" : "PENDING";

    return {
      id: n.id,
      nodeId: n.id,
      name: n.name || n.id,
      type: displayNodeType(n.type),
      status,
      startedAt,
      finishedAt,
      duration: startedAt && finishedAt ? msBetween(startedAt, finishedAt) : null,
      error: isFailed ? fail.get(n.id) ?? null : null,
    };
  });
}
