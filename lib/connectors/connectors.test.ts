jest.mock("./http", () => ({
  httpJson: jest.fn().mockRejectedValue(new Error("upstream unavailable")),
}));

import { agricultureConnector } from "./agricultureConnector";
import { dataGovConnector } from "./dataGovConnector";
import { employmentConnector } from "./employmentConnector";
import { governmentSchemesConnector } from "./governmentSchemesConnector";
import { weatherConnector } from "./weatherConnector";

describe("built-in connectors", () => {
  const connectors = [
    agricultureConnector,
    dataGovConnector,
    employmentConnector,
    governmentSchemesConnector,
    weatherConnector,
  ];

  it.each(connectors)("returns a disclosed mock fallback for $id when its upstream fails", async (connector) => {
    const result = await connector.search("Delhi services");

    expect(result.connectorId).toBe(connector.id);
    expect(result.summary).toMatch(/^\[MOCK\]/);
    expect(result.items.length).toBeGreaterThan(0);
  });
});
