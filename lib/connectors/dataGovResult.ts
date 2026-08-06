/**
 * Phase 10 (Part 3) — Shared helper for mapping data.gov.in results into a
 * normalized `ConnectorResult`.
 *
 * Reused by the data.gov.in, agriculture, and government-schemes connectors so
 * their live-result formatting stays consistent.
 */
import type { ConnectorItem, ConnectorResult } from "./types";

/**
 * Maps normalized data.gov.in items into a connector result envelope.
 *
 * @param connectorId  The requesting connector's stable id.
 * @param query        The original user query.
 * @param source       Source attribution label.
 * @param items        The normalized data.gov.in items (possibly empty).
 */
export function dataGovResult(
  connectorId: string,
  query: string,
  source: string,
  items: ConnectorItem[]
): ConnectorResult {
  const summary =
    items.length > 0
      ? `Found ${items.length} dataset(s) from ${source} for "${query}".`
      : `No datasets found on ${source} for "${query}".`;

  return {
    connectorId,
    query,
    summary,
    items,
    source,
    timestamp: Date.now(),
  };
}