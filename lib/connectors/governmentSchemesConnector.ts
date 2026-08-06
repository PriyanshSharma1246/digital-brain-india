/**
 * Phase 10 — Government Schemes Connector (placeholder).
 *
 * Mock implementation returning information about central-government
 * schemes, eligibility, and application portals.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { mockResult, today } from "./mockHelpers";

export const governmentSchemesConnector: DataConnector = {
  id: "government-schemes",
  name: "Government Schemes",
  description:
    "Central government schemes, eligibility criteria, and application portals (PMJDY, PM-KISAN, PMJJBY, etc.).",
  async isAvailable() {
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
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

    return mockResult(
      "government-schemes",
      query,
      "MyGov — Government of India",
      items
    );
  },
};

export default governmentSchemesConnector;
