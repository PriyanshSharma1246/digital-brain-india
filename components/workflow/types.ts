import type { Node as RFNode, Edge as RFEdge } from "reactflow";

/**
 * Phase 12.1 — Visual Workflow Builder shared types.
 *
 * The canvas keeps the canonical React Flow representation:
 *   nodes  -> { id, type, position, data }
 *   edges  -> { id, source, target }
 *
 * When persisting through the existing /api/workflows* endpoints we translate
 * to the backend's WorkflowDefinition shape (type / positionX / positionY /
 * configuration and sourceNode / targetNode) so saved workflows can be run by
 * the Phase 11 engine without modifying it.
 */

/** Builder-facing node types. */
export type BuilderNodeType = "trigger" | "agent" | "rag" | "tool" | "output";

/** Maps a builder node type to the backend workflow engine node type. */
export const BACKEND_TYPE: Record<BuilderNodeType, string> = {
  trigger: "CHAT",
  agent: "LLM",
  rag: "RAG",
  tool: "CONNECTOR",
  output: "END",
};

/** Reverse mapping used when loading a persisted workflow back into the canvas. */
export const UI_TYPE: Record<string, BuilderNodeType> = {
  CHAT: "trigger",
  LLM: "agent",
  RAG: "rag",
  CONNECTOR: "tool",
  END: "output",
};

/** Data payload carried by every React Flow node in the builder. */
export interface WorkflowNodeData {
  label: string;
  nodeType: BuilderNodeType;
  prompt?: string;
  temperature?: number;
  query?: string;
  topK?: number;
  connector?: string;
  template?: string;
  resultKey?: string;
}

export interface NodeMeta {
  label: string;
  description: string;
  color: string;
}

export const NODE_META: Record<BuilderNodeType, NodeMeta> = {
  trigger: { label: "Trigger", description: "User input / start", color: "#6366f1" },
  agent: { label: "AI Agent", description: "AI execution step", color: "#10b981" },
  rag: { label: "RAG", description: "Knowledge retrieval", color: "#f59e0b" },
  tool: { label: "Tool", description: "Connector / tool execution", color: "#f97316" },
  output: { label: "Output", description: "Final response", color: "#ec4899" },
};

/** Sensible defaults for a freshly added node so it can run out of the box. */
export function defaultNodeData(nodeType: BuilderNodeType): WorkflowNodeData {
  switch (nodeType) {
    case "trigger":
      return { label: "Trigger", nodeType, prompt: "Answer the user's query." };
    case "agent":
      return {
        label: "AI Agent",
        nodeType,
        prompt: "Review the retrieved context and produce a clear, helpful answer.",
        temperature: 0.7,
      };
    case "rag":
      return { label: "RAG", nodeType, query: "Retrieve relevant knowledge", topK: 5 };
    case "tool":
      return { label: "Tool", nodeType, connector: "weather", query: "" };
    case "output":
      return { label: "Output", nodeType, template: "", resultKey: "output" };
  }
}

/** Backend persisted node / edge shapes (match WorkflowDefinition). */
export interface BackendNode {
  id: string;
  type: string;
  name?: string | null;
  positionX?: number;
  positionY?: number;
  configuration?: Record<string, unknown>;
}

export interface BackendEdge {
  id: string;
  sourceNode: string;
  targetNode: string;
  condition?: string | null;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Builds the engine `configuration` object for a node from builder data. */
export function toBackendConfig(data: WorkflowNodeData): Record<string, unknown> {
  switch (data.nodeType) {
    case "trigger":
      return { prompt: data.prompt ?? "" };
    case "agent":
      return {
        prompt: data.prompt ?? "",
        ...(data.temperature != null ? { temperature: data.temperature } : {}),
      };
    case "rag":
      return { query: data.query ?? "", topK: data.topK ?? 5 };
    case "tool":
      return { connector: data.connector ?? "", query: data.query ?? "" };
    case "output":
      return {
        ...(data.template ? { template: data.template } : {}),
        resultKey: data.resultKey ?? "output",
      };
  }
}

/** Converts canvas nodes into the backend WorkflowDefinition nodes. */
export function toBackendNodes(nodes: RFNode[]): BackendNode[] {
  return nodes.map((n) => {
    const data = (n.data ?? {}) as WorkflowNodeData;
    const backendType = BACKEND_TYPE[data.nodeType] ?? String(n.type);
    return {
      id: n.id,
      type: backendType,
      name: data.label || backendType,
      positionX: round(n.position?.x ?? 0),
      positionY: round(n.position?.y ?? 0),
      configuration: toBackendConfig(data),
    };
  });
}

/** Converts canvas edges into the backend WorkflowDefinition edges. */
export function toBackendEdges(edges: RFEdge[]): BackendEdge[] {
  return edges.map((e) => ({ id: e.id, sourceNode: e.source, targetNode: e.target }));
}

/** Rebuilds a canvas node from a persisted backend node. */
export function fromBackendNode(n: BackendNode): RFNode {
  const nodeType = UI_TYPE[n.type] ?? "agent";
  const cfg = (n.configuration ?? {}) as Record<string, unknown>;
  const data: WorkflowNodeData = {
    label: n.name || NODE_META[nodeType].label,
    nodeType,
    prompt: typeof cfg.prompt === "string" ? cfg.prompt : undefined,
    temperature: typeof cfg.temperature === "number" ? cfg.temperature : undefined,
    query: typeof cfg.query === "string" ? cfg.query : undefined,
    topK: typeof cfg.topK === "number" ? cfg.topK : undefined,
    connector: typeof cfg.connector === "string" ? cfg.connector : undefined,
    template: typeof cfg.template === "string" ? cfg.template : undefined,
    resultKey: typeof cfg.resultKey === "string" ? cfg.resultKey : undefined,
  };
  return {
    id: n.id,
    type: nodeType,
    position: { x: n.positionX ?? 0, y: n.positionY ?? 0 },
    data,
  };
}

/** Rebuilds a canvas edge from a persisted backend edge. */
export function fromBackendEdge(e: BackendEdge): RFEdge {
  return { id: e.id, source: e.sourceNode, target: e.targetNode, type: "smoothstep" };
}
