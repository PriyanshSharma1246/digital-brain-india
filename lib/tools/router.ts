import type { AgentId } from "@/lib/agents";
import { getToolsForAgent } from "./registry";
import type { Tool, ToolResult } from "./types";
import { logError } from "@/lib/logger";

/**
 * Phase 7 — Tool Router.
 *
 * Decides whether a user message should trigger a tool, and executes it safely.
 *
 * Routing order (per the task spec):
 *   1. Manual agent — the router only considers tools enabled for the active
 *      agent (tools with an empty `enabledAgents` list are universal).
 *   2. Enabled tools — only tools available to that agent are candidates.
 *   3. canHandle()   — each candidate tool decides relevance via its cheap
 *      synchronous heuristic.
 *
 * If exactly one tool can handle the message it is executed. If multiple
 * tools match, the first registered match wins (registry order is the
 * declared priority).
 *
 * Tool failures NEVER fail the chat: `executeTool` catches every error,
 * logs it, and returns a failed ToolResult instead of throwing.
 */

/** Input to the tool router. */
export interface RouteToolInput {
  /** The user's message (already sanitized by the chat route). */
  message: string;
  /** The active agent id selected by the agent router / manual override. */
  agentId: AgentId;
}

/** Result of a tool routing decision. */
export interface RouteToolResult {
  /** The tool selected, or null when no tool matches. */
  tool: Tool | null;
  /** The candidate tools considered for this message/agent. */
  candidates: Tool[];
  /** True when a tool was selected for execution. */
  matched: boolean;
}

/**
 * Routes a user message to the first tool that can handle it.
 *
 * Returns `{ tool: null }` when no tool matches so the chat continues
 * normally (RAG -> prompt -> Gemini).
 */
export function routeTool(input: RouteToolInput): RouteToolResult {
  const { message, agentId } = input;

  // 1 + 2. Only consider tools enabled for the active agent.
  const candidates = getToolsForAgent(agentId);

  // 3. Let each candidate decide relevance.
  for (const tool of candidates) {
    try {
      if (tool.canHandle(message)) {
        return { tool, candidates, matched: true };
      }
    } catch (error) {
      // A broken canHandle must never break the chat — log and skip.
      logError("Tool canHandle threw", {
        toolId: tool.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { tool: null, candidates, matched: false };
}

/**
 * Executes a tool safely.
 *
 * Wraps `tool.execute()` in a try/catch so a throwing tool cannot fail the
 * chat. On success, returns the tool's result unchanged. On failure, logs the
 * error and returns a non-successful ToolResult that the prompt builder will
 * skip (so the chat continues normally).
 */
export async function executeTool(
  tool: Tool,
  input: string
): Promise<ToolResult> {
  const started = performance.now();
  try {
    const result = await tool.execute(input);
    return {
      ...result,
      toolId: tool.id,
      executionTime: performance.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("Tool execution failed", {
      toolId: tool.id,
      error: message,
    });
    return {
      success: false,
      toolId: tool.id,
      output: "",
      executionTime: performance.now() - started,
    };
  }
}

/** Convenience: routes and executes in one step (used by the chat route). */
export async function routeAndExecute(
  input: RouteToolInput
): Promise<{ result: ToolResult | null; matched: boolean; toolId: string | null }> {
  const { tool, matched } = routeTool(input);
  if (!tool) return { result: null, matched: false, toolId: null };

  const result = await executeTool(tool, input.message);
  return { result, matched, toolId: tool.id };
}