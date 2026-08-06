/**
 * Phase 10 (Part 4) — Structured logging for connector requests.
 *
 * Emits a stable JSON log envelope (source: "connector") for every connector
 * HTTP request / result so logs can be machine-filtered by connectorId,
 * mode, latency, attempts and status. Delegates to the shared logger with a
 * relative import so this module stays runnable under Node's test runner.
 */
import { logEvent, logError } from "../logger";

export interface ConnectorLogContext {
  /** Stable connector id (e.g. "weather"). */
  connectorId: string;
  /** The query that triggered the request (optional). */
  query?: string;
  /** "live" | "mock" | "error". */
  mode?: "live" | "mock" | "error";
  /** Request latency in ms. */
  latencyMs?: number;
  /** Retry attempt index (0-based). */
  attempt?: number;
  /** HTTP status when the upstream responded. */
  status?: number;
  /** Error message when applicable. */
  error?: string;
  /** Any extra fields to include. */
  extra?: Record<string, unknown>;
}

export function logConnectorEvent(
  level: "info" | "warn" | "error",
  message: string,
  context: ConnectorLogContext
): void {
  logEvent(level, message, {
    source: "connector",
    ...context.extra,
    connectorId: context.connectorId,
    query: context.query ?? null,
    mode: context.mode ?? null,
    latencyMs: context.latencyMs ?? null,
    attempt: context.attempt ?? null,
    status: context.status ?? null,
    error: context.error ?? null,
  });
}

export function logConnectorError(message: string, context: ConnectorLogContext): void {
  logError(message, {
    source: "connector",
    ...context.extra,
    connectorId: context.connectorId,
    query: context.query ?? null,
    mode: context.mode ?? null,
    latencyMs: context.latencyMs ?? null,
    attempt: context.attempt ?? null,
    status: context.status ?? null,
    error: context.error ?? null,
  });
}
