/**
 * Phase 10 (Part 4) — In-process connector metrics.
 *
 * Tracks requests, failures, latency and uptime per connector for the admin
 * dashboard. These are live counters (reset on server restart); longer-lived
 * history is persisted by ./persistence (see ConnectorHealthLog).
 */
export interface ConnectorMetric {
  /** Total requests recorded since the server started. */
  requests: number;
  /** Requests that fell back to mock or errored (failed "live" attempts). */
  failures: number;
  /** Successful live requests. */
  successCount: number;
  /** Sum of latencies (ms) — for computing averages. */
  latencyTotalMs: number;
  /** Latency (ms) of the most recent request. */
  lastLatencyMs: number;
  /** Minimum observed latency (ms), or null before any request. */
  minLatencyMs: number | null;
  /** Maximum observed latency (ms), or null before any request. */
  maxLatencyMs: number | null;
  /** Epoch ms when this connector was first observed. */
  firstSeenAt: number;
  /** Epoch ms of the last request. */
  lastSeenAt: number;
  /** Server-process uptime (ms) at last observation (proxy for service life). */
  uptimeMs: number;
}

const metrics = new Map<string, ConnectorMetric>();
const metricsProcessStartedAt = Date.now();

function blank(): ConnectorMetric {
  return {
    requests: 0,
    failures: 0,
    successCount: 0,
    latencyTotalMs: 0,
    lastLatencyMs: 0,
    minLatencyMs: null,
    maxLatencyMs: null,
    firstSeenAt: Date.now(),
    lastSeenAt: Date.now(),
    uptimeMs: Date.now() - metricsProcessStartedAt,
  };
}

/** Records one request outcome and returns the updated metric. */
export function recordMetric(
  connectorId: string,
  latencyMs: number,
  success: boolean
): ConnectorMetric {
  let metric = metrics.get(connectorId);
  if (!metric) {
    metric = blank();
    metrics.set(connectorId, metric);
  }

  metric.requests += 1;
  metric.lastLatencyMs = latencyMs;
  metric.latencyTotalMs += latencyMs;
  metric.lastSeenAt = Date.now();
  metric.uptimeMs = Date.now() - metricsProcessStartedAt;

  if (metric.minLatencyMs === null || latencyMs < metric.minLatencyMs) {
    metric.minLatencyMs = latencyMs;
  }
  if (metric.maxLatencyMs === null || latencyMs > metric.maxLatencyMs) {
    metric.maxLatencyMs = latencyMs;
  }

  if (success) {
    metric.successCount += 1;
  } else {
    metric.failures += 1;
  }
  return metric;
}

export function getMetric(connectorId: string): ConnectorMetric | undefined {
  return metrics.get(connectorId);
}

export function getAllMetrics(): Record<string, ConnectorMetric> {
  return Object.fromEntries(metrics);
}

/** Average latency (ms), or null when there are no requests. */
export function averageLatencyMs(metric: ConnectorMetric | undefined): number | null {
  if (!metric || metric.requests === 0) return null;
  return Math.round(metric.latencyTotalMs / metric.requests);
}

/** True when the connector has had at least one successful live request. */
export function wasLive(metric: ConnectorMetric | undefined): boolean {
  return Boolean(metric && metric.successCount > 0);
}

export function resetMetrics(connectorId?: string): void {
  if (connectorId) {
    metrics.delete(connectorId);
  } else {
    metrics.clear();
  }
}
