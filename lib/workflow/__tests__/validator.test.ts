import { validateWorkflow } from "../validator";
import type { WorkflowDefinition } from "../types";

describe("Workflow validator", () => {
  test("detects missing nodes referenced by edges", () => {
    const def = { id: "w1", nodes: [{ id: "n1" }], edges: [{ id: "e1", sourceNode: "n1", targetNode: "n2" }] } as unknown as WorkflowDefinition;
    const errors = validateWorkflow(def);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes("missing target node"))).toBeTruthy();
  });

  test("detects duplicate node ids", () => {
    const def = { id: "w1", nodes: [{ id: "n1" }, { id: "n1" }], edges: [] } as unknown as WorkflowDefinition;
    const errors = validateWorkflow(def);
    expect(errors.some((e) => e.message.includes("Duplicate node id"))).toBeTruthy();
  });

  test("detects simple cycle", () => {
    const def = {
      id: "w1",
      nodes: [{ id: "a" }, { id: "b" }],
      edges: [{ id: "e1", sourceNode: "a", targetNode: "b" }, { id: "e2", sourceNode: "b", targetNode: "a" }],
    } as unknown as WorkflowDefinition;
    const errors = validateWorkflow(def);
    expect(errors.some((e) => e.message.includes("Cycle detected"))).toBeTruthy();
  });
});
