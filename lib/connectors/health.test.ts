import {
  getAllConnectorHealth,
  getConnectorHealth,
  resetConnectorHealth,
  seedConnectorHealth,
} from "./health";

describe("health", () => {
  beforeEach(() => {
    resetConnectorHealth("weather");
    resetConnectorHealth("data-gov");
  });

  it("seeds a fresh health snapshot", () => {
    const health = seedConnectorHealth("weather", "IMD Weather");

    expect(health).toMatchObject({
      id: "weather",
      name: "IMD Weather",
      available: true,
      errorCount: 0,
      successCount: 0,
    });
  });

  it("returns the same snapshot on repeated seed", () => {
    expect(seedConnectorHealth("weather", "IMD Weather")).toBe(
      seedConnectorHealth("weather", "IMD Weather")
    );
  });

  it("returns undefined for an unknown connector", () => {
    expect(getConnectorHealth("unknown")).toBeUndefined();
  });

  it("returns all seeded snapshots", () => {
    seedConnectorHealth("weather", "IMD Weather");
    seedConnectorHealth("data-gov", "Government Data");

    expect(getAllConnectorHealth().map((health) => health.id)).toEqual([
      "data-gov",
      "weather",
    ]);
  });
});
