/**
 * Phase 8 — AI Planning & Multi-Agent Orchestration.
 *
 * Public API for the planner module:
 *   planQuery()       -> analyze a query and produce an execution plan
 *   executePlan()     -> run all selected agents (parallel or sequential)
 *   executeSingleAgent() -> run one agent (fast path)
 *   synthesize()      -> combine all agent outputs into one final prompt
 *   buildSingleAgentPrompt() -> single-agent prompt (backward compatible)
 */

export { planQuery } from "./planner";
export { executePlan, executeSingleAgent } from "./executor";
export { synthesize, buildSingleAgentPrompt } from "./synthesizer";

export type {
  AgentTask,
  ExecutionPlan,
  ExecutionMode,
  AgentExecutionContext,
  ConversationHistoryEntry,
  AgentExecutionResult,
  AgentResult,
  ExecutionResult,
  SynthesizerInput,
  SynthesizerOutput,
  PlannerStreamEvent,
} from "./types";