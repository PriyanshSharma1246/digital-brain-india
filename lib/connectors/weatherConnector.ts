/**
 * Phase 10 — Weather Connector (placeholder).
 *
 * Mock implementation backed by the India Meteorological Department (IMD).
 * Triggered automatically when the user query mentions weather-related
 * keywords, regardless of the routed agent.
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { mockResult, today } from "./mockHelpers";

export const weatherConnector: DataConnector = {
  id: "weather",
  name: "Weather",
  description:
    "India Meteorological Department (IMD) data — rainfall, temperature, and forecasts.",
  async isAvailable() {
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
    const items: ConnectorItem[] = [
      {
        title: "Today's Weather",
        description: `Weather conditions for ${query}.`,
        url: "https://mausam.imd.gov.in",
        source: "India Meteorological Department",
        date: today(),
      },
      {
        title: "7-Day Forecast",
        description: "District-level forecast outlook for the coming week.",
        url: "https://mausam.imd.gov.in/forecast",
        source: "IMD Forecast Division",
        date: today(),
      },
    ];

    return mockResult("weather", query, "India Meteorological Department", items);
  },
};

export default weatherConnector;
