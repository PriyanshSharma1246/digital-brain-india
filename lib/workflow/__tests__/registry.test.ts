import workflowRegistry from "../registry";

describe("Workflow registry", () => {
  test("has default node types registered", () => {
    const types = ["CHAT", "RAG", "CONNECTOR", "LLM", "MEMORY", "CONDITION", "END"];
    for (const t of types) {
      expect(workflowRegistry.has(t)).toBeTruthy();
    }
  });
});
