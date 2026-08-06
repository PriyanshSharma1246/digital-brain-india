/**
 * Phase 10 (Part 4) — Connector router tests.
 *
 * Verifies agent-to-connector mapping and keyword-based cross-agent triggers.
 */
import { routeConnectors, executeConnectors, CONNECTOR_DISPLAY } from "./router";

jest.mock("./registry", () => ({
  getConnector: jest.fn(),
  getEnabledConnectors: jest.fn(),
}));

const { getConnector, getEnabledConnectors } = jest.requireMock("./registry") as {
  getConnector: jest.Mock;
  getEnabledConnectors: jest.Mock;
};

const makeConnector = (id: string) => ({
  id,
  name: id,
  description: "test",
  async isAvailable() {
    return true;
  },
  async search() {
    return {
      connectorId: id,
      query: "",
      summary: `[LIVE] ${id} result`,
      items: [],
      timestamp: Date.now(),
    };
  },
});

beforeEach(() => {
  (getConnector as jest.Mock).mockReset();
  (getEnabledConnectors as jest.Mock).mockReset();
});

describe("routeConnectors", () => {
  it("maps agents to primary connectors", () => {
    expect(routeConnectors("agriculture", "crops")).toEqual(["agriculture"]);
    expect(routeConnectors("employment", "jobs")).toEqual(["employment"]);
    expect(routeConnectors("government", "schemes")).toEqual(["government-schemes"]);
    expect(routeConnectors("general", "anything")).toEqual(["data-gov"]);
  });

  it("triggers weather connector for weather keywords", () => {
    const result = routeConnectors("general", "What is the weather in Chennai?");
    expect(result).toEqual(["data-gov", "weather"]);
  });

  it("de-duplicates connector ids", () => {
    const result = routeConnectors("general", "weather government data");
    expect(result).toEqual(["data-gov", "weather"]);
  });

  it("falls back to data-gov for unknown agents", () => {
    expect(routeConnectors("finance", "budget")).toEqual(["data-gov"]);
  });
});

describe("executeConnectors", () => {
  it("executes enabled connectors in parallel", async () => {
    const c = makeConnector("data-gov");
    getEnabledConnectors.mockReturnValue([c]);
    getConnector.mockReturnValue(c);

    const results = await executeConnectors(["general"], "query");
    expect(results).toHaveLength(1);
    expect(results[0].connectorId).toBe("data-gov");
    expect(results[0].summary).toContain("[LIVE]");
  });

  it("skips disabled connectors", async () => {
    const c = makeConnector("weather");
    getEnabledConnectors.mockReturnValue([]);
    getConnector.mockReturnValue(c);

    const results = await executeConnectors(["general"], "weather");
    expect(results).toHaveLength(0);
  });
});

describe("CONNECTOR_DISPLAY", () => {
  it("defines display metadata for each connector", () => {
    expect(CONNECTOR_DISPLAY["data-gov"]).toBeDefined();
    expect(CONNECTOR_DISPLAY.weather).toBeDefined();
    expect(CONNECTOR_DISPLAY.agriculture).toBeDefined();
    expect(CONNECTOR_DISPLAY.employment).toBeDefined();
    expect(CONNECTOR_DISPLAY["government-schemes"]).toBeDefined();
  });
});
