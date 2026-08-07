export type NodeType =
  | "CHAT"
  | "RAG"
  | "CONNECTOR"
  | "LLM"
  | "MEMORY"
  | "CONDITION"
  | "END";

/** Valid workflow statuses. */
export type WorkflowStatus = "draft" | "active" | "archived";

/** Valid workflow run statuses. */
export type RunStatus = "running" | "completed" | "failed" | "cancelled";

export interface WorkflowDefinition {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  status?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface WorkflowNode {
  id: string;
  workflowId?: string;
  name?: string | null;
  type: NodeType | string;
  positionX?: number;
  positionY?: number;
  configuration?: Record<string, unknown> | null;
}

export interface WorkflowEdge {
  id: string;
  workflowId?: string;
  sourceNode: string;
  targetNode: string;
  condition?: string | null;
}

export interface WorkflowContext {
  runId: string;
  workflowId: string;
  userId?: string;
  /** Input variables injected at run start (from WorkflowRun.input). */
  variables: Record<string, unknown>;
}

export type NodeOutput = {
  nodeId: string;
  success: boolean;
  output?: Record<string, unknown> | null;
  error?: string;
};

export interface ExecutionResult {
  runId: string;
  outputs: NodeOutput[];
  logs: { level: string; message: string; metadata?: Record<string, unknown> }[];
  tokensUsed?: number;
  executionTimeMs?: number;
  error?: string | null;
}

export type NodeHandler = {
  execute: (context: WorkflowContext, node: WorkflowNode, inputs: Record<string, unknown>[]) => Promise<NodeOutput>;
  validate?: (node: WorkflowNode) => boolean;
};

/** Configuration consumed by the CHAT handler. */
export interface ChatNodeConfig {
  /** The prompt/query to send to the LLM. Supports ${var} interpolation. */
  prompt: string;
  /** Optional agent id override (auto-routed when omitted). */
  agent?: string;
  /** Optional system prompt override (defaults to the agent's system prompt). */
  systemPrompt?: string;
  /** Model to use (optional, defaults to env or 'gemini-2.0-flash'). */
  model?: string;
  /** Sampling temperature. */
  temperature?: number;
  /** Maximum output tokens. */
  maxTokens?: number;
  /** Whether to perform RAG retrieval before generation. */
  useRAG?: boolean;
  /** Whether to inject live web search context. */
  useLiveSearch?: boolean;
  /** Optional file uploads to include in the prompt. */
  files?: unknown[];
}

/** Configuration consumed by the RAG handler. */
export interface RagNodeConfig {
  /** The search query. Supports ${var} interpolation. */
  query: string;
  /** Maximum number of chunks to return. */
  topK?: number;
  categories?: string[];
  state?: string;
  language?: string;
  ministry?: string;
  tags?: string[];
  publishedAfter?: string;
  publishedBefore?: string;
}

/** Configuration consumed by the CONNECTOR handler. */
export interface ConnectorNodeConfig {
  /** The connector id (e.g. "weather", "data-gov"). */
  connector: string;
  /** Optional search query. Supports ${var} interpolation. */
  query?: string;
  /** Optional parameter template map. Supports ${var} interpolation. */
  params?: Record<string, unknown>;
}

/** Configuration consumed by the LLM handler. */
export interface LlmNodeConfig {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Configuration consumed by the MEMORY handler. */
export interface MemoryNodeConfig {
  /** "read" loads messages; "write" appends a message. */
  action: "read" | "write";
  /** Conversation id (falls back to runId or variables.conversationId). */
  conversationId?: string;
  /** Message content to store (required for "write"). Supports ${var} interpolation. */
  text?: string;
  /** Number of recent messages to return (for "read"). */
  limit?: number;
}

/** Configuration consumed by the CONDITION handler. */
export interface ConditionNodeConfig {
  /** A simple expression evaluated against node inputs. Format: ${field} <op> <value> */
  expression: string;
}

/** Configuration consumed by the END handler. */
export interface EndNodeConfig {
  /** Optional key under which the output is stored in the run's `output` field. */
  resultKey?: string;
  /** Template string describing the output (defaults to last upstream output). Supports ${var} interpolation. */
  template?: string;
}
