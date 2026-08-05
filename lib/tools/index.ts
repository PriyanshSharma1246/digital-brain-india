import { registerTools } from "./registry";
import { calculatorTool } from "./calculator";
import { dateTimeTool } from "./dateTime";
import { liveSearchTool } from "./liveSearch";

/**
 * Phase 7 — Tool registration point.
 *
 * Every new tool requires exactly two steps:
 *   1. Implement the `Tool` interface in `lib/tools/<name>.ts`.
 *   2. Import it here and add it to `ALL_TOOLS`.
 *
 * No other file needs to change. The registry auto-exposes the tool to the
 * router, prompt builder, and UI.
 */

export type { Tool, ToolResult, ToolMetadata, ToolFailure } from "./types";
export {
  registerTool,
  registerTools,
  getAllTools,
  getTool,
  getToolsForAgent,
  clearTools,
} from "./registry";
export { routeTool, executeTool, routeAndExecute } from "./router";
export type {
  RouteToolInput,
  RouteToolResult,
} from "./router";

export { calculatorTool } from "./calculator";
export { dateTimeTool } from "./dateTime";
export { liveSearchTool } from "./liveSearch";

/** All tools available to the chat pipeline. */
export const ALL_TOOLS = [calculatorTool, dateTimeTool, liveSearchTool];

/** Registers every built-in tool. Idempotent — safe to call repeatedly. */
export function initializeTools(): void {
  registerTools(ALL_TOOLS);
}