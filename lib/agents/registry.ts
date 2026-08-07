/**
 * Phase 11 — Agent Registry (reconciled with existing lib/agents.ts).
 *
 * The main application already defines its full agent catalogue in
 * `lib/agents.ts` (AGENT_DEFINITIONS, AGENT_LOOKUP, getAgent,
 * getAgentCategories). This module provides a thin registry wrapper so the
 * workflow engine can discover agents by id and register additional ones at
 * runtime without importing the full Phase 6 module graph.
 *
 * The `AgentDefinition` type re-exported here is the canonical one from
 * `lib/agents.ts`; the older ad-hoc shape that lived in this file has been
 * removed to eliminate the duplicate-definition conflict.
 */
import type { AgentDefinition } from "@/lib/agents";
import { AGENT_DEFINITIONS, getAgent, getAgentCategories } from "@/lib/agents";

// Re-export the canonical types and helpers so consumers have a single import.
export type { AgentId, AgentTool } from "@/lib/agents";
export type { AgentDefinition } from "@/lib/agents";
export { AGENT_DEFINITIONS, getAgent, getAgentCategories };

class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map();

  constructor() {
    // Seed with the existing static catalogue so get(id) works immediately.
    for (const agent of AGENT_DEFINITIONS) {
      this.agents.set(agent.id, agent);
    }
  }

  /** Registers (or replaces) an agent definition at runtime. */
  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent);
  }

  /** Returns the agent definition for the given id, or undefined. */
  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id);
  }

  /** Convenience: returns the agent or the "general" fallback. */
  getOrFallback(id: string | undefined): AgentDefinition {
    return this.agents.get(id ?? "") ?? AGENT_DEFINITIONS[0]!;
  }

  /** Returns every registered agent definition. */
  list(): AgentDefinition[] {
    return Array.from(this.agents.values());
  }

  /** Clears all runtime-registered agents (seeds are re-loaded on next call). */
  clearRuntime(): void {
    this.agents.clear();
    for (const agent of AGENT_DEFINITIONS) {
      this.agents.set(agent.id, agent);
    }
  }
}

export const agentRegistry = new AgentRegistry();

export default agentRegistry;

