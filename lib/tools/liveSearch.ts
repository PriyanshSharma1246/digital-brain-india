import type { Tool, ToolResult } from "./types";
import { looksLikeLiveQuery, searchLiveWeb } from "@/lib/liveIntelligence";

/**
 * Phase 7 — Live Search Adapter.
 *
 * Reuses the existing live search module (`lib/liveIntelligence.ts`) rather
 * than duplicating any provider logic. This is intentionally a thin adapter:
 * the underlying search implementation stays provider-agnostic and can be
 * swapped (e.g. DuckDuckGo -> Bing/Tavily) without touching this tool.
 *
 * The tool's `canHandle` reuses the same heuristic the live module already
 * exposes, so there is exactly one place that decides "does this need live
 * data?".
 */

/** Formats live results into a compact prompt-ready block. */
function formatResults(results: Array<{ title: string; url: string; snippet: string }>): string {
  if (results.length === 0) return "";

  return results
    .map((item, index) => `[${index + 1}] ${item.title}\nSource: ${item.url}\n${item.snippet}`)
    .join("\n\n");
}

async function execute(input: string): Promise<ToolResult> {
  const started = performance.now();

  // Reuse the existing search module — no provider logic duplicated here.
  const liveInfo = await searchLiveWeb(input);

  const output = formatResults(liveInfo.results);

  if (!liveInfo.shouldUseLiveInfo || liveInfo.results.length === 0) {
    return {
      success: false,
      toolId: "live-search",
      output: "",
      metadata: {
        label: "🌐 Live Search",
        summary: "No live search results available.",
      },
      executionTime: performance.now() - started,
    };
  }

  return {
    success: true,
    toolId: "live-search",
    output,
    metadata: {
      label: "🌐 Live Search",
      summary: `Found ${liveInfo.results.length} live result(s).`,
      source: "Live Web Search",
      urls: liveInfo.results.map((result) => result.url),
      data: liveInfo.results,
    },
    executionTime: performance.now() - started,
  };
}

/** The Live Search tool instance. */
export const liveSearchTool: Tool = {
  id: "live-search",
  name: "Live Search",
  description:
    "Searches the live web for current or recent information (news, schemes, notifications, weather, economy).",
  // Empty = available to all agents.
  enabledAgents: [],
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The query that requires current or recent information.",
      },
    },
    required: ["query"],
  },
  canHandle: (input: string) => looksLikeLiveQuery(input),
  execute,
};