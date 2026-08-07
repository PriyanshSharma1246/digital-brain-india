/**
 * Phase 10 (Part 3) — Connector health monitor.
 *
 * Tracks live availability, response time, last successful sync and error
 * count for every registered connector. `withHealthMonitoring()` wraps a
 * connector's `search()` so this bookkeeping happens automatically without
 * touching the connector's own logic.
 *
 * The monitor is in-memory and process-scoped — appropriate for per-instance
 * health dashboards on a single server. Each connector is seeded as
 * "available" and flips based on the last search outcome.
 */
import type { DataConnector, ConnectorResult } from "./types";
import { recordMetric } from "./metrics";
import { persistHealthLog } from "./persistence";

/** Health snapshot for a single connector. */
export interface ConnectorHealth {
  /** Connector id (stable, e.g. "weather"). */
  id: string;
  /** Human-readable connector name. */
  name: string;
  /** True when the last search used the live API (or no search yet). */
  available: boolean;
  /** Duration of the last search in milliseconds (null before first search). */
  responseTimeMs: number | null;
  /** Epoch ms when the last live (non-mock) search succeeded. */
  lastSuccessAt: number | null;
  /** Epoch ms of the last search attempt. */
  lastAttemptAt: number | null;
  /** Number of searches that fell back to mock (or threw). */
  errorCount: number;
  /** Number of searches that returned live data. */
  successCount: number;
  /** Mode used by the last search ("live", "mock", or null before first). */
  lastMode: "live" | "mock" | null;
}

const states = new Map<string, ConnectorHealth>();

function seed(id: string, name: string): ConnectorHealth {
  const existing = states.get(id);
  if (existing) return existing;
  const fresh: ConnectorHealth = {
    id,
    name,
    available: true,
    responseTimeMs: null,
    lastSuccessAt: null,
    lastAttemptAt: null,
    errorCount: 0,
    successCount: 0,
    lastMode: null,
  };
  states.set(id, fresh);
  return fresh;
}

function record(
  id: string,
  name: string,
  startedAt: number,
  mode: "live" | "mock",
  query?: string
): void {
  const state = seed(id, name);
  const responseTimeMs = Date.now() - startedAt;
  state.lastAttemptAt = Date.now();
  state.responseTimeMs = responseTimeMs;
  state.lastMode = mode;
  if (mode === "live") {
    state.available = true;
    state.lastSuccessAt = Date.now();
    state.successCount += 1;
  } else {
    state.available = false;
    state.errorCount += 1;
  }

  recordMetric(id, responseTimeMs, mode === "live");
  void persistHealthLog({
    connectorId: id,
    mode,
    success: mode === "live",
    available: state.available,
    latencyMs: responseTimeMs,
    query,
  });
}

function recordError(
  id: string,
  name: string,
  startedAt: number,
  query?: string,
  error?: string
): void {
  const state = seed(id, name);
  const responseTimeMs = Date.now() - startedAt;
  state.lastAttemptAt = Date.now();
  state.responseTimeMs = responseTimeMs;
  state.available = false;
  state.errorCount += 1;

  recordMetric(id, responseTimeMs, false);
  void persistHealthLog({
    connectorId: id,
    mode: "error",
    success: false,
    available: false,
    latencyMs: responseTimeMs,
    query,
    error,
  });
}

/** Registers an initial health snapshot for a connector (idempotent). */
export function seedConnectorHealth(id: string, name: string): ConnectorHealth {
  return seed(id, name);
}

/** Returns the health snapshot for one connector. */
export function getConnectorHealth(id: string): ConnectorHealth | undefined {
  return states.get(id);
}

/** Returns the health snapshots for every monitored connector. */
export function getAllConnectorHealth(sortBy?: "id" | "name"): ConnectorHealth[] {
  const list = Array.from(states.values());
  if (sortBy === "name") {
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return list.sort((a, b) => a.id.localeCompare(b.id));
}

/** Clears a connector's health snapshot (e.g. after a config change). */
export function resetConnectorHealth(id: string): void {
  states.delete(id);
}

/**
 * Wraps a connector so that every `search()` updates the health monitor.
 * Preserves the connector's public `DataConnector` shape (backward compatible).
 */
export function withHealthMonitoring(connector: DataConnector): DataConnector {
  const { id, name } = connector;
  seed(id, name);

  return {
    id: connector.id,
    name: connector.name,
    description: connector.description,
    async isAvailable(): Promise<boolean> {
      return connector.isAvailable();
    },
    async search(query: string): Promise<ConnectorResult> {
      const startedAt = Date.now();
      try {
        const result = await connector.search(query);
        // Connectors signal "live" vs "mock fallback" via the summary prefix.
        const isMock =
          typeof result.summary === "string" && result.summary.startsWith("[MOCK]");
        record(id, name, startedAt, isMock ? "mock" : "live", query);
        return result;
      } catch (error) {
        recordError(
          id,
          name,
          startedAt,
          query,
          error instanceof Error ? error.message : String(error)
        );
        throw error;
      }
    },
  };
}