import {
  averageLatencyMs,
  getMetric,
  recordMetric,
  resetMetrics,
  wasLive,
} from "./metrics";

describe("metrics", () => {
  beforeEach(() => {
    resetMetrics();
  });

  it("records request, failure, latency, and uptime metrics", () => {
    recordMetric("weather", 120, true);
    recordMetric("weather", 80, false);

    expect(getMetric("weather")).toMatchObject({
      requests: 2,
      failures: 1,
      successCount: 1,
      lastLatencyMs: 80,
      minLatencyMs: 80,
      maxLatencyMs: 120,
    });
    expect(averageLatencyMs(getMetric("weather"))).toBe(100);
    expect(wasLive(getMetric("weather"))).toBe(true);
  });

  it("returns empty values for unknown connectors", () => {
    expect(getMetric("employment")).toBeUndefined();
    expect(averageLatencyMs(undefined)).toBeNull();
    expect(wasLive(undefined)).toBe(false);
  });
});
