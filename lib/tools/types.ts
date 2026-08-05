import type { AgentId } from "@/lib/agents";

/**
 * Phase 7 — Modular Tool Calling Framework.
 *
 * Every tool implements the `Tool` interface below. Tools are self-contained,
 * provider-agnostic modules that the registry auto-discovers and the router
 * dispatches to. Adding a new tool requires only:
 *
 *   1. A single file implementing `Tool`.
 *   2. Registering it in `lib/tools/index.ts`.
 *
 * No changes to the chat route, prompt builder, or UI are needed.
 */

/** Metadata attached to a successful tool execution. */
export interface ToolMetadata {
  /** Human-readable label shown in the UI (e.g. "🧮 Calculator"). */
  label: string;
  /** Optional short summary of what the tool did. */
  summary?: string;
  /** Optional source attribution (e.g. a search provider name). */
  source?: string;
  /** Optional URL(s) returned by the tool (e.g. live search results). */
  urls?: string[];
  /** Optional structured data returned by the tool. */
  data?: unknown;
}

/** Result of a tool execution. */
export interface ToolResult {
  /** True when the tool completed successfully. */
  success: boolean;
  /** The id of the tool that produced this result. */
  toolId: string;
  /** Human-readable output to inject into the prompt. */
  output: string;
  /** Optional metadata for UI display and prompt enrichment. */
  metadata?: ToolMetadata;
  /** Execution time in milliseconds. */
  executionTime: number;
}

/**
 * A single tool.
 *
 * `canHandle` is a cheap, synchronous heuristic used by the router to decide
 * whether this tool might be relevant for a user message. `execute` performs
 * the actual work and must never throw — the router wraps it in a try/catch
 * and converts failures into a non-fatal result.
 */
export interface Tool {
  /** Stable unique id (e.g. "calculator"). */
  id: string;
  /** Display name (e.g. "Calculator"). */
  name: string;
  /** Short description used for logging and future AI routing. */
  description: string;
  /** Agents this tool is enabled for. Empty array = all agents. */
  enabledAgents: AgentId[];
  /** JSON Schema describing the tool's input (for future AI tool-calling). */
  inputSchema: unknown;
  /** Returns true when this tool might be able to handle the message. */
  canHandle(input: string): boolean;
  /** Executes the tool. Must never throw. */
  execute(input: string): Promise<ToolResult>;
}

/** A tool that failed to execute (used by the router's error handling). */
export interface ToolFailure {
  toolId: string;
  error: string;
}