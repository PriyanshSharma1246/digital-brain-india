/**
 * Phase 10 (Part 4) — Scheduled background refresh of important datasets.
 *
 * Periodically re-runs each connector's default "warm" query so its upstream
 * cache stays fresh without requiring user traffic. Refresh cadence honours
 * each connector's persisted `refreshIntervalSeconds` setting.
 *
 * Started from `instrumentation.ts` (Node runtime only) and guarded to run a
 * single interval per process. It is unref'd so it never keeps the Node event
 * loop alive by itself (important for short-lived serverless instances) and
 * every refresh fails gracefully.
 */
import { getConnector, getEnabledConnectors } from "./registry";
import { getRefreshIntervals, DEFAULT_REFRESH_INTERVAL_SECONDS } from "./config";
import { logConnectorEvent, logConnectorError } from "./logger";

/** Default query used to warm each connector's cache on refresh. */
const DEFAULT_QUERIES: Record<string, string> = {
  weather: "weather in New Delhi today",
  "data-gov": "government datasets in India",
  agriculture: "agriculture market prices PM-KISAN",
  employment: "government jobs NCS",
  "government-schemes": "government schemes PM-KISAN",
};

/** Default tick interval when refreshIntervalSeconds isn't configured. */
const FALLBACK_QUERY = "latest data";

const lastRefreshedAt = new Map<string, number>();
let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

function serverOnly(): boolean {
  // Guard: never schedule on the client or during a Next.js production build.
  if (typeof window !== "undefined") return false;
  if (process.env.NEXT_PHASE === "phase-production-build") return false;
  return true;
}

/**
 * Refreshes one connector's cache by running its warm query. Returns true on
 * a successful (live or mock) search; never throws.
 */
export async function refreshConnector(
  connectorId: string,
  query?: string
): Promise<boolean> {
  try {
    const connector = getConnector(connectorId);
    if (!connector) return false;
    const result = await connector.search(query ?? DEFAULT_QUERIES[connectorId] ?? FALLBACK_QUERY);
    lastRefreshedAt.set(connectorId, Date.now());
    logConnectorEvent("info", "connector scheduled refresh completed", {
      connectorId,
      mode: result.summary.startsWith("[MOCK]") ? "mock" : "live",
    });
    return true;
  } catch (error) {
    logConnectorError("connector scheduled refresh failed", {
      connectorId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Refreshes every enabled connector that is due according to its interval.
 * Returns a record of connectorId -> success for the refreshed ones.
 */
export async function refreshAll(): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};
  const now = Date.now();
  let intervals: Record<string, number> = {};
  try {
    intervals = await getRefreshIntervals();
  } catch {
    // Fall back to defaults below.
  }

  const connectors = getEnabledConnectors();
  for (const connector of connectors) {
    const intervalSeconds = intervals[connector.id] ?? DEFAULT_REFRESH_INTERVAL_SECONDS;
    const last = lastRefreshedAt.get(connector.id) ?? 0;
    if (now - last < intervalSeconds * 1000) continue;

    results[connector.id] = await refreshConnector(connector.id);
  }
  return results;
}

/**
 * Starts the background scheduler (idempotent). Safe to call more than once;
 * only ever creates a single interval. Interval duration is the base tick;
 * per-connector cadence is enforced inside `refreshAll`.
 */
export function startConnectorScheduler(tickIntervalMs = 60_000): void {
  if (started) return;
  if (!serverOnly()) return;
  started = true;

  timer = setInterval(() => {
    void refreshAll();
  }, tickIntervalMs);
  if (typeof timer.unref === "function") timer.unref();

  // First pass shortly after boot.
  const initial = setTimeout(() => {
    void refreshAll();
  }, 10_000);
  if (typeof (initial as ReturnType<typeof setTimeout>).unref === "function") {
    (initial as ReturnType<typeof setTimeout>).unref?.();
  }
}

/** Stops the scheduler (mainly for tests). */
export function stopConnectorScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
  lastRefreshedAt.clear();
}
