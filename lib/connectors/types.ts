/**
 * Phase 10 — Real-Time Government Data Integration.
 *
 * Defines the common contract that every government data connector
 * implements, plus the result envelope returned by `search()`.
 */

/** A single item returned by a data connector. */
export interface ConnectorItem {
  /** Human-readable title of the result. */
  title: string;
  /** Short description or snippet (may be empty). */
  description?: string;
  /** Canonical URL for the source (if available). */
  url?: string;
  /** Source attribution (e.g. "data.gov.in", "IMD"). */
  source: string;
  /** Date string when available (e.g. "2024-05-01"). */
  date?: string;
  /** Opaque payload for future structured access. */
  raw?: unknown;
}

/** The result envelope returned by every connector's `search()`. */
export interface ConnectorResult {
  /** The connector id that produced this result. */
  connectorId: string;
  /** The original query string passed to `search()`. */
  query: string;
  /** A short human-readable summary of the result set. */
  summary: string;
  /** The individual data items (empty when only a summary is available). */
  items: ConnectorItem[];
  /** Optional override source label. */
  source?: string;
  /** Epoch ms timestamp of when the result was produced. */
  timestamp: number;
}

/**
 * Common interface that every government data connector implements.
 *
 * Connectors are intentionally asynchronous: `isAvailable()` lets the
 * router check whether the live API / service is reachable, and `search()`
 * returns a structured result set. Placeholder connectors always report
 * themselves as available and return mock data.
 */
export interface DataConnector {
  /** Stable unique identifier (e.g. "weather"). */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Short description of what this connector covers. */
  description: string;
  /** Resolves to true when the underlying data source is reachable. */
  isAvailable(): Promise<boolean>;
  /** Searches the data source for the given query. */
  search(query: string): Promise<ConnectorResult>;
}
