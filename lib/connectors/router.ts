/**
 * Phase 10 — Connector Router.
 *
 * Determines which government data connector(s) should run for a given
 * user query and routed agent. The router is keyword-based today but is
 * isolated in its own module so a future AI classifier can replace the
 * internals without touching connectors or the chat pipeline.
 */
import type { AgentId } from "@/lib/agents";
import type { DataConnector, ConnectorResult } from "./types";
import { getConnector, getEnabledConnectors } from "./registry";

/** Maps every agent to its primary government data connector id. */
const AGENT_CONNECTOR_MAP: Record<AgentId, string> = {
  general: "data-gov",
  agriculture: "agriculture",
  government: "government-schemes",
  healthcare: "data-gov",
  education: "data-gov",
  employment: "employment",
  finance: "data-gov",
};

/** Query keywords that always trigger the weather connector. */
const WEATHER_KEYWORDS = [
  "weather",
  "rainfall",
  "rain",
  "climate",
  "temperature",
  "forecast",
  "monsoon",
  "imd",
];

/** Display metadata for connector badges in the UI. */
export const CONNECTOR_DISPLAY: Record<string, { icon: string; label: string }> = {
  "data-gov": { icon: "🏛", label: "Government Data" },
  weather: { icon: "🌦", label: "Weather" },
  agriculture: { icon: "🌾", label: "Agriculture" },
  employment: { icon: "💼", label: "Employment" },
  "government-schemes": { icon: "🏛", label: "Government Data" },
};

/**
 * Returns the list of connector ids that should execute for the given
 * agent and query. Results are de-duplicated and order is preserved.
 */
export function routeConnectors(agentId: AgentId, query: string): string[] {
  const lowerQuery = query.toLowerCase();
  const ids: string[] = [];

  // 1. Agent-based primary connector.
  const primary = AGENT_CONNECTOR_MAP[agentId] ?? "data-gov";
  if (!ids.includes(primary)) ids.push(primary);

  // 2. Cross-agent keyword triggers.
  if (WEATHER_KEYWORDS.some((kw) => lowerQuery.includes(kw))) {
    if (!ids.includes("weather")) ids.push("weather");
  }

  return ids;
}

/**
 * Executes every connector selected by `routeConnectors` for the given
 * agent ids and query. Connectors that are disabled, unavailable, or throw
 * are silently skipped so the chat pipeline is never broken.
 */
export async function executeConnectors(
  agentIds: AgentId[],
  query: string
): Promise<ConnectorResult[]> {
  // Collect unique connector ids across all participating agents.
  const allIds = new Set<string>();
  for (const agentId of agentIds) {
    for (const id of routeConnectors(agentId, query)) {
      allIds.add(id);
    }
  }

  const enabled = new Set(getEnabledConnectors().map((c) => c.id));
  const results: ConnectorResult[] = [];

  for (const id of allIds) {
    if (!enabled.has(id)) continue;
    const connector: DataConnector | undefined = getConnector(id);
    if (!connector) continue;
    try {
      const available = await connector.isAvailable();
      if (!available) continue;
      const result = await connector.search(query);
      results.push(result);
    } catch {
      // Silently skip — connectors must never break the chat.
    }
  }

  return results;
}
