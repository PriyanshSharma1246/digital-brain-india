/**
 * Phase 10 — Shared helpers for placeholder (mock) connectors.
 *
 * These utilities let each connector return realistic-looking mock data
 * with minimal boilerplate. When a real API integration lands, the
 * connector file can simply swap the `search()` implementation.
 */
import type { ConnectorItem, ConnectorResult } from "./types";

/** Returns today's date in YYYY-MM-DD format. */
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Builds a standardized mock `ConnectorResult`.
 *
 * @param connectorId  The registering connector's id.
 * @param query        The original user query string.
 * @param source       Source attribution for the result.
 * @param items        The mock data items to include.
 * @param note         Optional disclosure appended to the summary.
 */
export function mockResult(
  connectorId: string,
  query: string,
  source: string,
  items: ConnectorItem[],
  note = "Real API integration pending."
): ConnectorResult {
  return {
    connectorId,
    query,
    summary:
      items.length > 0
        ? `[MOCK] Found ${items.length} result(s) from ${source} for "${query}". ${note}`
        : `[MOCK] No results from ${source} for "${query}". ${note}`,
    items,
    source,
    timestamp: Date.now(),
  };
}
