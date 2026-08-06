/**
 * Phase 10 — Connector module barrel export.
 *
 * Re-exports the public API and auto-registers all built-in placeholder
 * connectors on import. Importing any symbol from `@/lib/connectors`
 * triggers registration, so connectors are ready the moment the chat API
 * (or any other consumer) imports this module.
 */
export type { DataConnector, ConnectorResult, ConnectorItem } from "./types";

export {
  registerConnector,
  unregisterConnector,
  getConnector,
  getAllConnectors,
  getEnabledConnectors,
  setConnectorEnabled,
} from "./registry";

export { routeConnectors, executeConnectors, CONNECTOR_DISPLAY } from "./router";
export { formatConnectorResults } from "./formatter";

import { registerConnector } from "./registry";
import { dataGovConnector } from "./dataGovConnector";
import { weatherConnector } from "./weatherConnector";
import { agricultureConnector } from "./agricultureConnector";
import { employmentConnector } from "./employmentConnector";
import { governmentSchemesConnector } from "./governmentSchemesConnector";

// Auto-register all built-in connectors (mock / placeholder mode).
registerConnector(dataGovConnector);
registerConnector(weatherConnector);
registerConnector(agricultureConnector);
registerConnector(employmentConnector);
registerConnector(governmentSchemesConnector);
