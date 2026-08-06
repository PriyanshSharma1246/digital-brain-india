/**
 * Phase 10 — data.gov.in Connector (placeholder).
 *
 * Mock implementation of the national open-data portal connector.
 * Returns sample datasets across agriculture, finance, healthcare, etc.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { mockResult, today } from "./mockHelpers";

export const dataGovConnector: DataConnector = {
  id: "data-gov",
  name: "Data.gov.in",
  description:
    "India's national open data portal — datasets across agriculture, finance, healthcare, education, governance, and taxation.",
  async isAvailable() {
    // Mock: the portal is always considered reachable.
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
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
  },
};

export default dataGovConnector;
