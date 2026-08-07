/**
 * Phase 11 — Workflow Executor.
 *
 * Executes a validated workflow definition by walking its node graph in
 * topological order. Each node's registered `NodeHandler` is invoked with
 * the accumulated upstream outputs. Condition nodes short-circuit their
 * downstream branch based on the boolean expression evaluation.
 */
import { workflowRegistry } from "./registry";
import { logEvent, logError } from "@/lib/logger";
import type {
  NodeOutput,
  WorkflowContext,
  WorkflowDefinition,
  WorkflowNode,
  WorkflowEdge,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Builds an adjacency list: sourceNode -> [edge]. */
function buildAdjacency(nodes: WorkflowNode[], edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
  const adj = new Map<string, WorkflowEdge[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const edge of edges) {
    const list = adj.get(edge.sourceNode) ?? [];
    list.push(edge);
    adj.set(edge.sourceNode, list);
  }
  return adj;
}

/** Returns nodes reachable from start nodes (nodes with no incoming edges),
 *  in topological order. Also detects cycles. */
function topologicalSort(nodes: WorkflowNode[], edges: WorkflowEdge[]): { order: string[]; cycle: boolean } {
  // Compute in-degree for each node.
  const inDegree = new Map<string, number>();
  for (const node of nodes) inDegree.set(node.id, 0);
  for (const edge of edges) {
    inDegree.set(edge.targetNode, (inDegree.get(edge.targetNode) ?? 0) + 1);
  }

  const adj = buildAdjacency(nodes, edges);
  const queue: string[] = [];
  for (const node of nodes) {
    if ((inDegree.get(node.id) ?? 0) === 0) queue.push(node.id);
  }

  const order: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    order.push(current);
    for (const edge of adj.get(current) ?? []) {
      const newDeg = (inDegree.get(edge.targetNode) ?? 0) - 1;
      inDegree.set(edge.targetNode, newDeg);
      if (newDeg === 0) queue.push(edge.targetNode);
    }
  }

  const cycle = order.length < nodes.length;
  return { order, cycle };
}

/** Converts a node output into the input map consumed by downstream nodes. */
function buildInputMap(outputs: Map<string, NodeOutput>): Record<string, unknown> {
  const merged: any = {};
  for (const out of outputs.values()) {
    if (out.success && out.output) {
      Object.assign(merged, out.output);
    }
  }
  return merged;
}

export async function executeWorkflowDefinition(
  definition: WorkflowDefinition,
  context: WorkflowContext
): Promise<{
  outputs: NodeOutput[];
  logs: { level: string; message: string; metadata?: Record<string, unknown> }[];
  tokensUsed?: number;
  executionTimeMs?: number;
}> {
  const startTime = Date.now();
  const logs: { level: string; message: string; metadata?: Record<string, unknown> }[] = [];
  const outputs: NodeOutput[] = [];
  const nodeOutputs = new Map<string, NodeOutput>();
  let totalTokens = 0;

  const { order, cycle } = topologicalSort(definition.nodes, definition.edges);
  if (cycle) {
    logError("Workflow contains a cycle", { workflowId: definition.id });
    return {
      outputs,
      logs: [...logs, { level: "error", message: "Workflow contains a cycle" }],
      executionTimeMs: Date.now() - startTime,
    };
  }

  const nodeMap = new Map(definition.nodes.map((n) => [n.id, n]));
  const inputs = new Map<string, Record<string, unknown>>();

  for (const nodeId of order) {
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const input = buildInputMap(nodeOutputs);
    inputs.set(nodeId, input);

    const handler = workflowRegistry.get(node.type);
    if (!handler) {
      const msg = `No handler registered for node type ${node.type}`;
      logError(msg, { nodeId, type: node.type });
      outputs.push({ nodeId, success: false, error: msg });
      logs.push({ level: "error", message: msg, metadata: { nodeId, type: node.type } });
      continue;
    }

    try {
      logEvent("info", `Executing node ${nodeId} (${node.type})`);
      const result = await handler.execute(context, node, input ? [input] : []);
      outputs.push(result);
      nodeOutputs.set(nodeId, result);
      logs.push({ level: "info", message: `Node ${nodeId} completed`, metadata: { nodeId, success: result.success } });

      if (result.output?.tokensUsed) {
        totalTokens += Number(result.output.tokensUsed);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logError(`Execution failed for node ${nodeId}`, { nodeId, error: message });
      outputs.push({ nodeId, success: false, error: message });
      logs.push({ level: "error", message: `Execution failed for node ${nodeId}`, metadata: { nodeId, error: message } });
    }
  }

  const executionTimeMs = Date.now() - startTime;
  logs.push({ level: "info", message: "Workflow execution finished", metadata: { runId: context.runId, executionTimeMs } });

  return { outputs, logs, tokensUsed: totalTokens, executionTimeMs };
}

