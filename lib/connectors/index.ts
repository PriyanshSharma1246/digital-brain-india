/**
 * Phase 10 — Connector module barrel export.
 *
 * Re-exports the public API and auto-registers all built-in connectors on
 * import. Importing any symbol from `@/lib/connectors` triggers
 * registration, so connectors are ready the moment the chat API (or any
 * other consumer) imports this module.
 *
 * Phase 10 (Part 3): every connector is wrapped with health monitoring at
 * registration time so the admin dashboard can report availability / latency
 * without altering any connector's public interface.
 */
export type {
  DataConnector,
  ConnectorResult,
  ConnectorItem,
  ConnectorHealth,
} from "./types";

export {
  registerConnector,
  unregisterConnector,
  getConnector,
  getAllConnectors,
  getEnabledConnectors,
  setConnectorEnabled,
} from "./registry";

export {
  seedConnectorHealth,
  getConnectorHealth,
  getAllConnectorHealth,
  resetConnectorHealth,
} from "./health";

export { routeConnectors, executeConnectors, CONNECTOR_DISPLAY } from "./router";
export { formatConnectorResults } from "./formatter";
export { getAllMetrics, getMetric, averageLatencyMs } from "./metrics";

import { registerConnector } from "./registry";
import { withHealthMonitoring } from "./health";
import { dataGovConnector } from "./dataGovConnector";
import { weatherConnector } from "./weatherConnector";
import { agricultureConnector } from "./agricultureConnector";
import { employmentConnector } from "./employmentConnector";
import { governmentSchemesConnector } from "./governmentSchemesConnector";

// Auto-register all built-in connectors. Each is wrapped with health
// monitoring so search outcomes update the admin-dashboard status.
registerConnector(withHealthMonitoring(dataGovConnector));
registerConnector(withHealthMonitoring(weatherConnector));
registerConnector(withHealthMonitoring(agricultureConnector));
registerConnector(withHealthMonitoring(employmentConnector));
registerConnector(withHealthMonitoring(governmentSchemesConnector));
