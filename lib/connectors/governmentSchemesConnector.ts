/**
 * Phase 10 (Part 3) — Government Schemes Connector (live + mock fallback).
 *
 * Returns central-government scheme datasets from the data.gov.in open-data
 * portal when a DATA_GOV_API_KEY is configured. On any failure (or when no
 * key is present) it gracefully falls back to the original mock
 * implementation. Preserves the same `DataConnector` shape and id.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { createDataGovClient } from "./dataGovClient";
import { dataGovResult } from "./dataGovResult";
import { mockResult, today } from "./mockHelpers";

/** Builds the original mock fallback result (unchanged content). */
function buildMock(query: string): ConnectorResult {
  const items: ConnectorItem[] = [
    {
      title: `Scheme matching "${query}"`,
      description: "Eligibility, benefits, and documents required for the scheme.",
      url: "https://www.mygov.in",
      source: "MyGov — Government of India",
      date: today(),
    },
    {
      title: "PMJDY — Pradhan Mantri Jan Dhan Yojana",
      description: "Bank account, RuPay card, and accidental insurance coverage.",
      url: "https://pmjdw.com",
      source: "Ministry of Finance",
      date: today(),
    },
  ];

  return mockResult("government-schemes", query, "MyGov — Government of India", items);
}

/** Performs the live schemes lookup via data.gov.in (throws on failure). */
async function liveSearch(query: string): Promise<ConnectorResult> {
  const client = createDataGovClient({ connectorId: "government-schemes" });
  if (!client.isConfigured) throw new Error("DATA_GOV_API_KEY not configured.");

  // Search for scheme-related datasets on the national open-data portal.
  const res = await client.search(`${query} scheme government`);

  const items: ConnectorItem[] = res.items.map((item) => ({
    title: item.title,
    description: item.description,
    url: item.url,
    source: item.source ?? "MyGov — Government of India",
    date: item.date,
  }));

  return dataGovResult("government-schemes", query, "data.gov.in — Government of India", items);
}

export const governmentSchemesConnector: DataConnector = {
  id: "government-schemes",
  name: "Government Schemes",
  description:
    "Central government schemes, eligibility criteria, and application portals (PMJDY, PM-KISAN, PMJJBY, etc.).",
  async isAvailable() {
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
    try {
      return await liveSearch(query);
    } catch {
      // Graceful fallback — the live source failed, keep the chat running.
      return buildMock(query);
    }
  },
};

export default governmentSchemesConnector;

