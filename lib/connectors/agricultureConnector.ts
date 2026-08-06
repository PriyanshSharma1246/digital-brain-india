/**
 * Phase 10 (Part 3) — Agriculture Connector (live + mock fallback).
 *
 * Returns PM-KISAN / agricultural datasets from the data.gov.in open-data
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
      title: `Agri-market prices for "${query}"`,
      description: "Sample price data from e-NAM and state APMCs.",
      url: "https://enam.gov.in",
      source: "Ministry of Agriculture — e-NAM",
      date: today(),
    },
    {
      title: "Crop advisory bulletin",
      description: "Weather-based advisory for the current sowing season.",
      url: "https://dbcmb.gov.in",
      source: "Department of Agriculture & Farmers Welfare",
      date: today(),
    },
  ];

  return mockResult("agriculture", query, "Ministry of Agriculture", items);
}

/** Performs the live agriculture lookup via data.gov.in (throws on failure). */
async function liveSearch(query: string): Promise<ConnectorResult> {
  const client = createDataGovClient({ connectorId: "agriculture" });
  if (!client.isConfigured) throw new Error("DATA_GOV_API_KEY not configured.");

  // Search for agriculture / PM-KISAN related datasets.
  const res = await client.search(`${query} agriculture PM-KISAN`);

  const items: ConnectorItem[] = res.items.map((item) => ({
    title: item.title,
    description: item.description,
    url: item.url,
    source: item.source ?? "Ministry of Agriculture",
    date: item.date,
  }));

  return dataGovResult("agriculture", query, "data.gov.in — Ministry of Agriculture", items);
}

export const agricultureConnector: DataConnector = {
  id: "agriculture",
  name: "Agriculture",
  description:
    "Farming, crop prices, rural livelihoods, and agri-scheme data from the Ministry of Agriculture.",
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

export default agricultureConnector;

