/**
 * Phase 10 (Part 4) — Best-effort persistence of connector health history.
 *
 * Writes one `ConnectorHealthLog` row per connector search so the admin
 * dashboard can report long-lived availability / latency / failure history
 * in the database. All operations are best-effort: any DB failure is caught
 * and ignored so connector requests are never blocked or broken by storage
 * problems (e.g. unavailable backend or unrun migrations).
 */
import { prisma } from "../prisma";

export type ConnectorMode = "live" | "mock" | "error";

export interface HealthLogInput {
  connectorId: string;
  mode: ConnectorMode;
  success: boolean;
  available: boolean;
  latencyMs: number;
  error?: string;
  query?: string;
}

/** Aggregated history for one connector derived from persisted logs. */
export interface ConnectorHistorySummary {
  connectorId: string;
  /** Total logged requests. */
  requests: number;
  /** Requests that failed or fell back to mock. */
  failures: number;
  /** Successful live requests. */
  successCount: number;
  /** Average latency (ms) across persisted requests, or null. */
  avgLatencyMs: number | null;
  /** Epoch ms of the most recent logged request, or null. */
  lastAt: number | null;
  /** Count of mock-fallback requests. */
  mockCount: number;
}

/**
 * Persists a single health log row. Resolves without throwing — callers may
 * `await` it or `void` it safely.
 */
export async function persistHealthLog(input: HealthLogInput): Promise<void> {
  try {
    await prisma.connectorHealthLog.create({
      data: {
        connectorId: input.connectorId,
        mode: input.mode,
        success: input.success,
        available: input.available,
        latencyMs: input.latencyMs,
        error: input.error ?? null,
        query: input.query ?? null,
      },
    });
  } catch {
    // Best-effort persistence — never break the caller on DB failure.
  }
}

/**
 * Returns an aggregate summary of a connector's persisted health history.
 * Returns null when the database is unavailable / has no rows.
 */
export async function getHealthHistorySummary(
  connectorId: string
): Promise<ConnectorHistorySummary | null> {
  try {
    const [total, failures, mockCount, avg, latest] = await Promise.all([
      prisma.connectorHealthLog.count({ where: { connectorId } }),
      prisma.connectorHealthLog.count({ where: { connectorId, success: false } }),
      prisma.connectorHealthLog.count({ where: { connectorId, mode: "mock" } }),
      prisma.connectorHealthLog.aggregate({
        where: { connectorId },
        _avg: { latencyMs: true },
      }),
      prisma.connectorHealthLog.findFirst({
        where: { connectorId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      connectorId,
      requests: total,
      failures,
      successCount: total - failures,
      avgLatencyMs: avg._avg.latencyMs != null ? Math.round(avg._avg.latencyMs) : null,
      lastAt: latest ? latest.createdAt.getTime() : null,
      mockCount,
    };
  } catch {
    return null;
  }
}
