/**
 * Phase 10 — Connector Registry.
 *
 * A simple in-memory registry that stores every registered data connector.
 * Connectors register themselves on import via `registerConnector()`.
 */
import type { DataConnector } from "./types";

/** Internal storage: connector id -> connector instance. */
const registry = new Map<string, DataConnector>();

/** Connectors explicitly disabled (e.g. via admin config). */
const disabledConnectorIds = new Set<string>();

/**
 * Registers a data connector so it can be discovered by the router.
 * Calling this more than once for the same id replaces the previous entry.
 */
export function registerConnector(connector: DataConnector): void {
  registry.set(connector.id, connector);
}

/**
 * Removes a connector from the registry.
 */
export function unregisterConnector(id: string): void {
  registry.delete(id);
  disabledConnectorIds.delete(id);
}

/**
 * Retrieves a single connector by id.
 */
export function getConnector(id: string): DataConnector | undefined {
  return registry.get(id);
}

/**
 * Returns every registered connector, regardless of enabled state.
 */
export function getAllConnectors(): DataConnector[] {
  return Array.from(registry.values());
}

/**
 * Returns every registered connector that has not been explicitly disabled.
 * By default all connectors are enabled (mock / placeholder mode).
 */
export function getEnabledConnectors(): DataConnector[] {
  return Array.from(registry.values()).filter(
    (connector) => !disabledConnectorIds.has(connector.id)
  );
}

/**
 * Programmatically enables or disables a connector.
 * Disabled connectors are excluded from `getEnabledConnectors()` and will
 * not be selected by the connector router.
 */
export function setConnectorEnabled(id: string, enabled: boolean): void {
  if (enabled) {
    disabledConnectorIds.delete(id);
  } else {
    disabledConnectorIds.add(id);
  }
}
