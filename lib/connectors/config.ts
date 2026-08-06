/**
 * Phase 10 (Part 4) — Persisted connector configuration.
 *
 * Stores per-connector enable/disable and refresh-interval settings in the
 * `ConnectorConfig` table so the admin dashboard controls survive restarts.
 * Reads are cached briefly; writes are best-effort (DB failures never break
 * the request — settings still apply in-memory via the registry).
 */
import { prisma } from "../prisma";
import { getCache, setCache, clearCache } from "../cache";
import { setConnectorEnabled, getAllConnectors } from "./registry";

export const DEFAULT_REFRESH_INTERVAL_SECONDS = 3600;
export const MIN_REFRESH_INTERVAL_SECONDS = 60;
export const MAX_REFRESH_INTERVAL_SECONDS = 86_400;

export interface ConnectorSettings {
  connectorId: string;
  enabled: boolean;
  refreshIntervalSeconds: number;
}

const SETTINGS_CACHE_TTL = 60;
const settingsCacheKey = "connector:config:all";

/** Loads every persisted connector setting into a Map (cached briefly). */
export async function loadAllConnectorSettings(): Promise<Map<string, ConnectorSettings>> {
  const cached = getCache<Array<ConnectorSettings>>(settingsCacheKey);
  if (cached) return new Map(cached.map((s) => [s.connectorId, s]));

  let rows: Array<{
    connectorId: string;
    enabled: boolean;
    refreshIntervalSeconds: number;
  }> = [];
  try {
    rows = await prisma.connectorConfig.findMany();
  } catch {
    rows = [];
  }

  const map = new Map<string, ConnectorSettings>();
  for (const row of rows) {
    map.set(row.connectorId, {
      connectorId: row.connectorId,
      enabled: row.enabled,
      refreshIntervalSeconds: row.refreshIntervalSeconds,
    });
  }
  setCache(settingsCacheKey, Array.from(map.values()), SETTINGS_CACHE_TTL);
  return map;
}

/** Returns one connector's settings (with a sensible default when absent). */
export async function getConnectorSettings(connectorId: string): Promise<ConnectorSettings> {
  const map = await loadAllConnectorSettings();
  return (
    map.get(connectorId) ?? {
      connectorId,
      enabled: true,
      refreshIntervalSeconds: DEFAULT_REFRESH_INTERVAL_SECONDS,
    }
  );
}

/**
 * Creates/updates a connector's config and applies the enabled state to the
 * live registry immediately. Never throws (best-effort persistence).
 */
export async function upsertConnectorConfig(
  connectorId: string,
  patch: { enabled?: boolean; refreshIntervalSeconds?: number }
): Promise<ConnectorSettings> {
  if (!getAllConnectors().some((connector) => connector.id === connectorId)) {
    throw new Error(`Unknown connector: ${connectorId}`);
  }
  if (
    patch.refreshIntervalSeconds !== undefined &&
    (!Number.isInteger(patch.refreshIntervalSeconds) ||
      patch.refreshIntervalSeconds < MIN_REFRESH_INTERVAL_SECONDS ||
      patch.refreshIntervalSeconds > MAX_REFRESH_INTERVAL_SECONDS)
  ) {
    throw new Error(
      `refreshIntervalSeconds must be an integer between ${MIN_REFRESH_INTERVAL_SECONDS} and ${MAX_REFRESH_INTERVAL_SECONDS}.`
    );
  }

  const fallback: ConnectorSettings = {
    connectorId,
    enabled: patch.enabled ?? true,
    refreshIntervalSeconds:
      patch.refreshIntervalSeconds ?? DEFAULT_REFRESH_INTERVAL_SECONDS,
  };
  let persisted = true;
  try {
    await prisma.connectorConfig.upsert({
      where: { connectorId },
      create: {
        connectorId,
        enabled: patch.enabled ?? true,
        refreshIntervalSeconds:
          patch.refreshIntervalSeconds ?? DEFAULT_REFRESH_INTERVAL_SECONDS,
      },
      update: {
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.refreshIntervalSeconds !== undefined
          ? { refreshIntervalSeconds: patch.refreshIntervalSeconds }
          : {}),
      },
    });
  } catch {
    // Best-effort — still applied in-memory below.
    persisted = false;
  }

  clearCache(settingsCacheKey);
  const settings = persisted ? await getConnectorSettings(connectorId) : fallback;
  setConnectorEnabled(connectorId, settings.enabled);
  return settings;
}

/**
 * Ensures a config row exists for every registered connector, then applies
 * all persisted enabled states to the live registry. Called at startup.
 */
export async function applyConnectorConfigs(): Promise<void> {
  try {
    const connectors = getAllConnectors();
    for (const connector of connectors) {
      await prisma.connectorConfig.upsert({
        where: { connectorId: connector.id },
        create: {
          connectorId: connector.id,
          enabled: true,
          refreshIntervalSeconds: DEFAULT_REFRESH_INTERVAL_SECONDS,
        },
        update: {},
      });
    }
  } catch {
    // Best-effort.
  }

  clearCache(settingsCacheKey);
  const map = await loadAllConnectorSettings();
  for (const settings of map.values()) {
    setConnectorEnabled(settings.connectorId, settings.enabled);
  }
}

/** Returns the scheduler refresh interval (seconds) per connector id. */
export async function getRefreshIntervals(): Promise<Record<string, number>> {
  const map = await loadAllConnectorSettings();
  const intervals: Record<string, number> = {};
  for (const [id, settings] of map) {
    intervals[id] = settings.refreshIntervalSeconds;
  }
  return intervals;
}
