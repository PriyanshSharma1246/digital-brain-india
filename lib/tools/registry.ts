import type { AgentId } from "@/lib/agents";
import type { Tool } from "./types";

/**
 * Phase 7 — Tool Registry.
 *
 * The registry owns the collection of all available tools and exposes the
 * helper methods the router, prompt builder, and UI consume:
 *
 *   getAllTools()          -> every registered tool
 *   getTool(id)            -> a single tool by id (or undefined)
 *   getToolsForAgent(id)   -> tools enabled for a specific agent
 *
 * Tools are registered in `lib/tools/index.ts` (the single registration point).
 */

const registeredTools: Tool[] = [];

/**
 * Registers a tool with the registry. Idempotent per tool id — re-registering
 * the same id replaces the previous instance. Throws when the tool is invalid.
 */
export function registerTool(tool: Tool): void {
  if (!tool || typeof tool.id !== "string" || !tool.id.trim()) {
    throw new Error("Tool registration failed: tool must have a non-empty id.");
  }

  const existingIndex = registeredTools.findIndex((t) => t.id === tool.id);
  if (existingIndex >= 0) {
    registeredTools[existingIndex] = tool;
    return;
  }
  registeredTools.push(tool);
}

/** Registers multiple tools at once (used by the index barrel). */
export function registerTools(tools: Tool[]): void {
  for (const tool of tools) {
    registerTool(tool);
  }
}

/** Returns every registered tool. */
export function getAllTools(): Tool[] {
  return [...registeredTools];
}

/** Returns a single tool by id, or undefined when not registered. */
export function getTool(toolId: string): Tool | undefined {
  return registeredTools.find((tool) => tool.id === toolId);
}

/**
 * Returns the tools enabled for a specific agent.
 *
 * A tool is enabled for an agent when either:
 *   - its `enabledAgents` is empty (universally available), or
 *   - its `enabledAgents` includes the agent id.
 */
export function getToolsForAgent(agentId: AgentId): Tool[] {
  return registeredTools.filter(
    (tool) => tool.enabledAgents.length === 0 || tool.enabledAgents.includes(agentId)
  );
}

/** Clears all registered tools (used primarily by tests). */
export function clearTools(): void {
  registeredTools.length = 0;
}