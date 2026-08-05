import type { AgentId } from "@/lib/agents";
import type { RetrievedChunk } from "@/lib/ai/search";
import type { ToolResult } from "@/lib/tools";

/**
 * Phase 8 — AI Planning & Multi-Agent Orchestration types.
 *
 * These types define the contract between the Planner, Executor, and
 * Synthesizer. The planner produces an execution plan, the executor runs
 * each agent independently, and the synthesizer merges the results into a
 * single final answer.
 */

/** Execution mode for a set of agents. */
export type ExecutionMode = "parallel" | "sequential";

/** A single agent task in the execution plan. */
export interface AgentTask {
  /** The agent to execute. */
  agentId: AgentId;
  /** Human-readable agent name (resolved from the registry). */
  agentName: string;
  /** Agent icon for the UI. */
  agentIcon: string;
  /** Why this agent was selected (for UI transparency). */
  reason: string;
  /** Knowledge categories this agent is allowed to search. */
  categories: string[];
}

/** The execution plan produced by the planner. */
export interface ExecutionPlan {
  /** The original user query. */
  query: string;
  /** Agents selected to run. */
  agents: AgentTask[];
  /** Whether agents run in parallel or sequentially. */
  mode: ExecutionMode;
  /** True when the plan is a single-agent fast path (no orchestration). */
  isSingleAgent: boolean;
  /** True when the planner decided to use the general agent only. */
  isGeneralOnly: boolean;
  /** Optional reasoning summary for the UI. */
  summary: string;
}

/** Context shared by every agent during execution. */
export interface AgentExecutionContext {
  /** The sanitized user message. */
  message: string;
  /** Recent conversation history (oldest first). */
  conversationHistory: ConversationHistoryEntry[];
  /** Uploaded file text context (empty when no files). */
  fileContext: string;
  /** Live web context (empty when not applicable). */
  liveContext: string;
  /** Optional image payload for multimodal turns. */
  imagePayload?: unknown;
}

/** A single conversation history entry. */
export interface ConversationHistoryEntry {
  role: "user" | "assistant";
  content: string;
}

/** Result of a single agent execution. */
export interface AgentExecutionResult {
  /** The agent that ran. */
  agentId: AgentId;
  /** Agent display name. */
  agentName: string;
  /** Agent icon. */
  agentIcon: string;
  /** True when the agent completed successfully. */
  success: boolean;
  /** Error message when the agent failed (never fails the whole chat). */
  error?: string;
  /** Chunks retrieved by this agent's RAG search. */
  retrievedChunks: RetrievedChunk[];
  /** Tool result produced by this agent (null when no tool ran). */
  toolResult: ToolResult | null;
  /** Tool id used by this agent (null when no tool ran). */
  usedToolId: string | null;
  /** Live web context gathered for this agent. */
  liveContext: string;
  /** Execution time in milliseconds. */
  executionTime: number;
}

/** Result of the full executor run. */
export interface ExecutionResult {
  /** Results for every agent that ran (successful or failed). */
  agentResults: AgentResult[];
  /** The execution plan that was executed. */
  plan: ExecutionPlan;
  /** Total execution time in milliseconds. */
  totalTime: number;
}

/** A single agent result (success or failure). */
export interface AgentResult {
  /** Agent that ran. */
  agentId: AgentId;
  /** Agent display name. */
  agentName: string;
  /** Agent icon. */
  agentIcon: string;
  /** True when the agent completed successfully. */
  success: boolean;
  /** Error message when the agent failed. */
  error?: string;
  /** Chunks retrieved by this agent's RAG search. */
  retrievedChunks: RetrievedChunk[];
  /** Tool result produced by this agent. */
  toolResult: ToolResult | null;
  /** Tool id used by this agent. */
  usedToolId: string | null;
  /** Live web context used for this agent. */
  liveContext: string;
  /** Execution time in milliseconds. */
  executionTime: number;
}

/** Input to the synthesizer. */
export interface SynthesizerInput {
  /** The original user query. */
  query: string;
  /** The execution plan. */
  plan: ExecutionPlan;
  /** Results from every agent. */
  agentResults: AgentResult[];
  /** Conversation history for context. */
  conversationHistory: ConversationHistoryEntry[];
  /** Uploaded file context. */
  fileContext: string;
}

/** Output of the synthesizer. */
export interface SynthesizerOutput {
  /** The final prompt sent to Gemini. */
  prompt: string;
  /** True when any agent retrieved RAG chunks. */
  ragUsed: boolean;
  /** All unique document titles retrieved across agents. */
  retrievedDocumentTitles: string[];
  /** All unique source paths retrieved across agents. */
  sourcePaths: string[];
  /** All agents that participated. */
  participatingAgents: AgentId[];
  /** All tool ids used across agents. */
  usedToolIds: string[];
  /** All tool labels used across agents. */
  usedToolLabels: string[];
}

/** Stream event types emitted by the chat route. */
export type PlannerStreamEvent =
  | { type: "planning"; plan: ExecutionPlan }
  | { type: "agent-start"; agentId: AgentId; agentName: string; agentIcon: string }
  | { type: "agent-done"; agentId: AgentId; agentName: string; agentIcon: string; success: boolean }
  | { type: "synthesizing" }
  | { type: "chunk"; text: string }
  | { type: "done"; reply: string; conversationId: string; retrievedDocumentTitles: string[]; sourcePaths: string[]; ragUsed: boolean; agents: AgentId[]; agentNames: string[]; agentIcons: string[]; usedToolIds: string[]; usedToolLabels: string[] }
  | { type: "error"; error: string };