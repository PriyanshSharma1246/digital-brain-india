import type { AgentId } from "@/lib/agents";
import { AGENT_DEFINITIONS, getAgent, getAgentCategories } from "@/lib/agents";
import { routeQuery } from "@/lib/aiRouter";
import type { ExecutionPlan, ExecutionMode } from "./types";

/**
 * Phase 8 — Planner.
 *
 * Analyzes a user query and produces an execution plan: which agents run,
 * parallel vs sequential, and a summary for the UI. Reuses the existing
 * keyword router to score every specialist agent.
 */

const MIN_SPECIALIST_SCORE = 2;
const MAX_AGENTS = 3;

const MULTI_DOMAIN_HINTS = [
  "and", "compare", "difference", "both", "also", "plus", "versus", "vs",
  "as well as", "along with", "related", "overview", "summary", "everything", "all about",
];

const SEQUENTIAL_HINTS = [
  "then", "after that", "next", "first", "step by step", "process", "procedure", "how to", "steps",
];

function scoreAgentForQuery(agentId: AgentId, text: string): number {
  const routed = routeQuery(text);
  if (routed.agentId === agentId) {
    return routed.isSpecialist ? routed.score : 0;
  }
  return 0;
}

function detectMultiDomain(text: string, scoredAgents: Array<{ agentId: AgentId; score: number }>): boolean {
  const hasHint = MULTI_DOMAIN_HINTS.some((hint) => text.includes(hint));
  const specialistCount = scoredAgents.filter((entry) => entry.score >= MIN_SPECIALIST_SCORE).length;
  return hasHint && specialistCount >= 2;
}

export function planQuery(
  message: string,
  options: { manualAgent?: AgentId | null } = {}
): ExecutionPlan {
  const text = message.toLowerCase().trim();
  const { manualAgent } = options;

  if (manualAgent) {
    const agent = getAgent(manualAgent);
    return {
      query: message,
      agents: [{
        agentId: manualAgent,
        agentName: agent.name,
        agentIcon: agent.icon,
        reason: "Manually selected by the user",
        categories: getAgentCategories(manualAgent),
      }],
      mode: "parallel",
      isSingleAgent: true,
      isGeneralOnly: manualAgent === "general",
      summary: `Using ${agent.name} as selected by the user.`,
    };
  }

  const scoredAgents = AGENT_DEFINITIONS.filter((agent) => agent.id !== "general").map(
    (agent) => ({
      agentId: agent.id as AgentId,
      score: scoreAgentForQuery(agent.id as AgentId, text),
    })
  );

  const specialists = scoredAgents
    .filter((entry) => entry.score >= MIN_SPECIALIST_SCORE)
    .sort((a, b) => b.score - a.score);

  if (detectMultiDomain(text, scoredAgents) && specialists.length >= 2) {
    const selected = specialists.slice(0, MAX_AGENTS);
    const tasks = selected.map((entry) => {
      const agent = getAgent(entry.agentId);
      return {
        agentId: entry.agentId,
        agentName: agent.name,
        agentIcon: agent.icon,
        reason: `Query matches ${agent.name.toLowerCase()} keywords (score ${entry.score})`,
        categories: getAgentCategories(entry.agentId),
      };
    });

    const mode: ExecutionMode = SEQUENTIAL_HINTS.some((hint) => text.includes(hint))
      ? "sequential"
      : "parallel";

    return {
      query: message,
      agents: tasks,
      mode,
      isSingleAgent: false,
      isGeneralOnly: false,
      summary: `Planning ${tasks.length} agents (${mode}): ${tasks.map((t) => t.agentName).join(", ")}.`,
    };
  }

  if (specialists.length === 1) {
    const entry = specialists[0];
    const agent = getAgent(entry.agentId);
    return {
      query: message,
      agents: [{
        agentId: entry.agentId,
        agentName: agent.name,
        agentIcon: agent.icon,
        reason: `Query matches ${agent.name.toLowerCase()} keywords (score ${entry.score})`,
        categories: getAgentCategories(entry.agentId),
      }],
      mode: "parallel",
      isSingleAgent: true,
      isGeneralOnly: false,
      summary: `Using ${agent.name} for this query.`,
    };
  }

  const general = getAgent("general");
  return {
    query: message,
    agents: [{
      agentId: "general",
      agentName: general.name,
      agentIcon: general.icon,
      reason: "No specialist agent matched; using the general assistant",
      categories: getAgentCategories("general"),
    }],
    mode: "parallel",
    isSingleAgent: true,
    isGeneralOnly: true,
    summary: "Using the General Assistant for this query.",
  };
}