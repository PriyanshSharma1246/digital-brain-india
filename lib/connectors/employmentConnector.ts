/**
 * Phase 10 — Employment Connector (placeholder).
 *
 * Mock implementation returning job vacancies, skill programs, and
 * employment-scheme data relevant to the query.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { mockResult, today } from "./mockHelpers";

export const employmentConnector: DataConnector = {
  id: "employment",
  name: "Employment",
  description:
    "Jobs, skill programs, and workforce-scheme data from the Ministry of Skill Development and Labour.",
  async isAvailable() {
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
    const items: ConnectorItem[] = [
      {
        title: `Job vacancies matching "${query}"`,
        description: "Sample openings from National Career Service and public-sector portals.",
        url: "https://www.ncs.gov.in",
        source: "National Career Service",
        date: today(),
      },
      {
        title: "Skill India training programs",
        description: "Short-term and long-term skilling courses available online.",
        url: "https://www.swayam.gov.in/skills",
        source: "Ministry of Skill Development and Technology",
        date: today(),
      },
      {
        title: "MGNREGA job cards",
        description: "Work-demand registration statistics and wage data.",
        url: "https://nrega.nic.in",
        source: "Ministry of Rural Development",
        date: today(),
      },
    ];

    return mockResult("employment", query, "National Career Service", items);
  },
};

export default employmentConnector;
