/**
 * Phase 10 — Connector result formatting.
 *
 * Turns `ConnectorResult[]` into a human-readable prompt section that is
 * shared by the single-agent prompt builder and the multi-agent synthesizer.
 */
import type { ConnectorResult } from "./types";

/**
 * Formats an array of connector results into a "Live Government Data"
 * section suitable for injection into the Gemini prompt.
 *
 * Returns an empty string when no results are present so the caller can
 * skip the section entirely (keeps prompts compact).
 */
export function formatConnectorResults(
  results: ConnectorResult[] | undefined | null
): string {
  if (!results || results.length === 0) return "";

  const sections = results.map((result) => {
    const source = result.source ?? result.connectorId;

    const itemsList =
      result.items.length > 0
        ? result.items
            .map((item) => {
              let line = `- **${item.title}**`;
              if (item.description) line += `: ${item.description}`;
              if (item.url) line += ` ([source](${item.url}))`;
              if (item.date) line += ` (📅 ${item.date})`;
              return line;
            })
            .join("\n")
        : `> ${result.summary}`;

    return `**${source}**\n${result.summary}\n\n${itemsList}`;
  });

  return `## Live Government Data\n\n${sections.join("\n\n")}`;
}
