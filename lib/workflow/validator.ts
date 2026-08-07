import type { WorkflowDefinition } from "./types";
import { workflowRegistry } from "./registry";
import { logError, logEvent } from "@/lib/logger";

export type ValidationError = { message: string };

export function validateWorkflow(def: WorkflowDefinition): ValidationError[] {
  const errors: ValidationError[] = [];

  const nodeIds = new Set(def.nodes.map((n) => n.id));

  // 1. Missing nodes referenced by edges
  for (const e of def.edges) {
    if (!nodeIds.has(e.sourceNode)) {
      errors.push({ message: `Edge ${e.id} references missing source node ${e.sourceNode}` });
    }
    if (!nodeIds.has(e.targetNode)) {
      errors.push({ message: `Edge ${e.id} references missing target node ${e.targetNode}` });
    }
  }

  // 2. Duplicate node ids
  const seen = new Set<string>();
  for (const n of def.nodes) {
    if (seen.has(n.id)) {
      errors.push({ message: `Duplicate node id ${n.id}` });
    }
    seen.add(n.id);
  }

  // 3. Empty workflow (no nodes)
  if (def.nodes.length === 0) {
    errors.push({ message: "Workflow has no nodes" });
  }

  // 4. Orphaned nodes (no incoming or outgoing edges) — warn but don't fail
  const connected = new Set<string>();
  for (const e of def.edges) {
    connected.add(e.sourceNode);
    connected.add(e.targetNode);
  }
  const orphaned = def.nodes.filter((n) => !connected.has(n.id));
  if (orphaned.length > 0) {
    logEvent("warn", `Workflow ${def.id} has orphaned nodes`, { orphaned: orphaned.map((n) => n.id) });
  }

  // 5. Handler configuration validation
  for (const node of def.nodes) {
    const handler = workflowRegistry.get(node.type);
    if (handler?.validate && !handler.validate(node)) {
      errors.push({ message: `Node ${node.id} (${node.type}) has invalid configuration` });
    }
  }

  // 6. At least one END node
  const endNodes = def.nodes.filter((n) => n.type === "END");
  if (endNodes.length === 0 && def.nodes.length > 0) {
    errors.push({ message: "Workflow must have at least one END node" });
  }

  // 7. Cycle detection via DFS
  const adj = new Map<string, string[]>();
  for (const n of def.nodes) adj.set(n.id, []);
  for (const e of def.edges) {
    const arr = adj.get(e.sourceNode) || [];
    arr.push(e.targetNode);
    adj.set(e.sourceNode, arr);
  }

  const WHITE = 0, GRAY = 1, BLACK = 2;
  const colors = new Map<string, number>();
  for (const id of nodeIds) colors.set(id, WHITE);

  let cycleFound = false;
  const path: string[] = [];

  function dfs(u: string) {
    if (cycleFound) return;
    colors.set(u, GRAY);
    path.push(u);
    const neighbors = adj.get(u) ?? [];
    for (const v of neighbors) {
      const c = colors.get(v) ?? WHITE;
      if (c === GRAY) {
        cycleFound = true;
        const cyclePath = [...path, v].join(" -> ");
        errors.push({ message: `Cycle detected: ${cyclePath}` });
        return;
      }
      if (c === WHITE) dfs(v);
      if (cycleFound) return;
    }
    path.pop();
    colors.set(u, BLACK);
  }

  for (const id of nodeIds) {
    if ((colors.get(id) ?? WHITE) === WHITE) dfs(id);
    if (cycleFound) break;
  }

  if (errors.length === 0) logEvent("info", `Workflow ${def.id} validated successfully`);
  else logError(`Workflow ${def.id} validation failed`, { errors });

  return errors;
}
