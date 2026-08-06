/**
 * Phase 10 — Agriculture Connector (placeholder).
 *
 * Mock implementation returning agricultural market prices, crop advisories,
 * and scheme information for the query.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { mockResult, today } from "./mockHelpers";

export const agricultureConnector: DataConnector = {
  id: "agriculture",
  name: "Agriculture",
  description:
    "Farming, crop prices, rural livelihoods, and agri-scheme data from the Ministry of Agriculture.",
  async isAvailable() {
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
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
  },
};

export default agricultureConnector;
