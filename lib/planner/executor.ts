import type { AgentId } from "@/lib/agents";
import { getAgent, getAgentCategories } from "@/lib/agents";
import { searchKnowledge } from "@/lib/ai/rag";
import { searchLiveWeb } from "@/lib/liveIntelligence";
import { initializeTools, routeAndExecute } from "@/lib/tools";
import type { ToolResult } from "@/lib/tools";
import { logError } from "@/lib/logger";
import type {
  AgentExecutionContext,
  AgentResult,
  ExecutionPlan,
  ExecutionResult,
} from "./types";

/**
 * Phase 8 — Executor.
 *
 * Runs every agent in the execution plan independently. Each agent:
 *   1. Routes and executes a tool (scoped by agent).
 *   2. Performs RAG retrieval scoped to the agent's categories.
 *   3. Gathers live web context when relevant.
 *
 * Agents run in parallel via Promise.all() when the plan says parallel.
 * If one agent fails, the others continue — a failed agent never fails
 * the whole chat.
 */

/** Runs a single agent task and returns its result. */
async function runAgent(
  task: ExecutionPlan["agents"][number],
  context: AgentExecutionContext
): Promise<AgentResult> {
  const started = performance.now();
  const agentId = task.agentId;
  const agent = getAgent(agentId);
  const categories = getAgentCategories(agentId);

  try {
    // 1. Tool routing + execution (scoped by agent).
    initializeTools();
    const toolExecution = await routeAndExecute({
      message: context.message,
      agentId,
    });
    const toolResult: ToolResult | null = toolExecution.result;
    const usedToolId: string | null = toolExecution.toolId;

    // 2. RAG retrieval scoped to the agent's categories.
    const searchResult = await searchKnowledge(context.message, {
      topK: 4,
      categories,
    });
    const retrievedChunks = searchResult.chunks;

    // 3. Live web context (skip when the live-search tool already ran).
    let liveContext = "";
    if (usedToolId === "live-search") {
      if (toolResult?.success && toolResult.output) {
        liveContext = toolResult.output;
      }
    } else {
      const liveInfo = await searchLiveWeb(context.message);
      liveContext = liveInfo.shouldUseLiveInfo && liveInfo.context ? liveInfo.context : "";
    }

    return {
      agentId,
      agentName: agent.name,
      agentIcon: agent.icon,
      success: true,
      retrievedChunks,
      toolResult,
      usedToolId,
      liveContext,
      executionTime: performance.now() - started,
    };
  } catch (error) {
    logError("Agent execution failed", {
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      agentId,
      agentName: agent.name,
      agentIcon: agent.icon,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      retrievedChunks: [],
      toolResult: null,
      usedToolId: null,
      liveContext: "",
      executionTime: performance.now() - started,
    };
  }
}

/**
 * Executes the full plan.
 *
 * Parallel plans use Promise.all() so all agents run concurrently.
 * Sequential plans run agents one at a time (used for step-by-step
 * queries where ordered context matters).
 */
export async function executePlan(
  plan: ExecutionPlan,
  context: AgentExecutionContext
): Promise<ExecutionResult> {
  const started = performance.now();

  let agentResults: AgentResult[];
  if (plan.mode === "parallel") {
    agentResults = await Promise.all(
      plan.agents.map((task) => runAgent(task, context))
    );
  } else {
    agentResults = [];
    for (const task of plan.agents) {
      agentResults.push(await runAgent(task, context));
    }
  }

  return {
    agentResults,
    plan,
    totalTime: performance.now() - started,
  };
}

/** Convenience: runs a single agent (used by the fast path). */
export async function executeSingleAgent(
  agentId: AgentId,
  context: AgentExecutionContext
): Promise<AgentResult> {
  const agent = getAgent(agentId);
  return runAgent(
    {
      agentId,
      agentName: agent.name,
      agentIcon: agent.icon,
      reason: "Single-agent fast path",
      categories: getAgentCategories(agentId),
    },
    context
  );
}