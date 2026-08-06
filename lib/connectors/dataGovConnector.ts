/**
 * Phase 10 (Part 2) — Data.gov.in Connector (live API + mock fallback).
 *
 * Replaces the previous pure placeholder with a live integration backed by
 * the data.gov.in open-data API (via the reusable client in ./dataGovClient).
 *
 * Backward compatibility is preserved: the exported connector keeps the same
 * id, name, description and `DataConnector` shape. When the live API is not
 * configured (no DATA_GOV_API_KEY) or fails for any reason, `search()`
 * transparently falls back to the original mock implementation so the chat
 * pipeline is never broken.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { createDataGovClient, DataGovSearchResult } from "./dataGovClient";
import { mockResult, today } from "./mockHelpers";

/** Builds the original mock fallback result (unchanged content). */
function buildMockResult(query: string): ConnectorResult {
  const items: ConnectorItem[] = [
    {
      title: `Open Government Datasets matching "${query}"`,
      description:
        "Aggregated statistics and datasets from data.gov.in covering multiple ministries.",
      url: "https://data.gov.in/data-topic/agriculture",
      source: "data.gov.in",
      date: today(),
    },
    {
      title: `API Catalog — ${query} related endpoints`,
      description:
        "Machine-readable APIs available for programmatic access to government data.",
      url: "https://data.gov.in/catalog",
      source: "data.gov.in — API Catalog",
      date: today(),
    },
  ];

  return mockResult("data-gov", query, "data.gov.in", items);
}

/** Maps a normalized client result into a connector `ConnectorResult`. */
function buildConnectorResult(query: string, result: DataGovSearchResult): ConnectorResult {
  const items: ConnectorItem[] = result.items.map((item) => ({
    title: item.title,
    description: item.description,
    url: item.url,
    source: item.source ?? "data.gov.in",
    date: item.date,
    ...(item.raw !== undefined ? { raw: item.raw } : {}),
  }));

  const summary =
    items.length > 0
      ? `Found ${items.length} dataset(s) from data.gov.in for "${query}".`
      : `No datasets found on data.gov.in for "${query}".`;

  return {
    connectorId: "data-gov",
    query,
    summary,
    items,
    source: "data.gov.in",
    timestamp: Date.now(),
  };
}

export const dataGovConnector: DataConnector = {
  id: "data-gov",
  name: "Data.gov.in",
  description:
    "India's national open data portal — datasets across agriculture, finance, healthcare, education, governance, and taxation.",
  async isAvailable() {
    // Always considered reachable: if the live API is unreachable or not
    // configured, `search()` transparently falls back to the mock provider.
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
    const client = createDataGovClient();

    // No API key configured — immediately fall back to the mock provider.
    if (!client.isConfigured) {
      return buildMockResult(query);
    }

    try {
      const result = await client.search(query);
      return buildConnectorResult(query, result);
    } catch {
      // Graceful fallback on API failure (timeout, retries exhausted, etc.).
      return buildMockResult(query);
    }
  },
};

export default dataGovConnector;
