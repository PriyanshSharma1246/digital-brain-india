/**
 * Phase 10 (Part 4) — Persistence tests.
 *
 * Verifies the health log aggregation helper and config loader use the
 * expected Prisma query shapes.
 */
import { prisma } from "../prisma";
import {
  persistHealthLog,
  getHealthHistorySummary,
} from "./persistence";

jest.mock("../prisma", () => ({
  prisma: {
    connectorHealthLog: {
      create: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      findFirst: jest.fn(),
    },
    connectorConfig: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockedPrisma = jest.mocked(prisma, { shallow: true });

describe("persistence", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("persistHealthLog", () => {
    it("creates a health log row (best-effort)", async () => {
      (mockedPrisma.connectorHealthLog.create as jest.Mock).mockResolvedValue({
        id: "log-1",
        connectorId: "weather",
      });

      await persistHealthLog({
        connectorId: "weather",
        mode: "live",
        success: true,
        available: true,
        latencyMs: 120,
        query: "Delhi weather",
      });

      expect(mockedPrisma.connectorHealthLog.create).toHaveBeenCalledWith({
        data: {
          connectorId: "weather",
          mode: "live",
          success: true,
          available: true,
          latencyMs: 120,
          error: null,
          query: "Delhi weather",
        },
      });
    });

    it("swallows DB errors without throwing", async () => {
      (mockedPrisma.connectorHealthLog.create as jest.Mock).mockRejectedValue(
        new Error("db down")
      );

      await expect(
        persistHealthLog({
          connectorId: "weather",
          mode: "error",
          success: false,
          available: false,
          latencyMs: 5000,
          error: "timeout",
        })
      ).resolves.toBeUndefined();
    });
  });

  describe("getHealthHistorySummary", () => {
    it("aggregates persisted history", async () => {
      (mockedPrisma.connectorHealthLog.count as jest.Mock)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);
      (mockedPrisma.connectorHealthLog.aggregate as jest.Mock).mockResolvedValue({
        _avg: { latencyMs: 150 },
      });
      (mockedPrisma.connectorHealthLog.findFirst as jest.Mock).mockResolvedValue({
        createdAt: new Date("2024-05-01T00:00:00Z"),
      });

      const summary = await getHealthHistorySummary("weather");
      expect(summary).toEqual({
        connectorId: "weather",
        requests: 10,
        failures: 2,
        successCount: 8,
        avgLatencyMs: 150,
        lastAt: expect.any(Number),
        mockCount: 3,
      });
    });

    it("returns null on DB failure", async () => {
      (mockedPrisma.connectorHealthLog.count as jest.Mock).mockRejectedValue(
        new Error("db down")
      );

      const summary = await getHealthHistorySummary("weather");
      expect(summary).toBeNull();
    });
  });
});
