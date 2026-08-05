import type { AgentId } from "@/lib/agents";
import { getAgent } from "@/lib/agents";
import { buildKnowledgeContext } from "@/lib/ai/rag";
import type { RetrievedChunk } from "@/lib/ai/search";
import type { ToolResult } from "@/lib/tools";
import type {
  AgentResult,
  ConversationHistoryEntry,
  ExecutionPlan,
  SynthesizerInput,
  SynthesizerOutput,
} from "./types";

/**
 * Phase 8 — Synthesizer.
 *
 * Combines all agent responses into a single final prompt for Gemini.
 * The synthesizer:
 *   1. Deduplicates retrieved chunks across agents (by chunk id).
 *   2. Merges tool results (keeps the first successful result per tool).
 *   3. Builds a structured prompt with per-agent sections so the model
 *      sees each specialist's context before producing the final answer.
 *   4. Preserves citations and source attribution.
 */

/** Deduplicates chunks across agents by chunk id. */
function dedupeChunks(results: AgentResult[]): RetrievedChunk[] {
  const seen = new Set<string>();
  const chunks: RetrievedChunk[] = [];
  for (const result of results) {
    for (const chunk of result.retrievedChunks) {
      if (!seen.has(chunk.chunkId)) {
        seen.add(chunk.chunkId);
        chunks.push(chunk);
      }
    }
  }
  return chunks;
}

/** Merges tool results, keeping the first successful result per tool id. */
function mergeToolResults(results: AgentResult[]): ToolResult[] {
  const seen = new Set<string>();
  const tools: ToolResult[] = [];
  for (const result of results) {
    if (result.toolResult?.success && result.toolResult.output) {
      if (!seen.has(result.toolResult.toolId)) {
        seen.add(result.toolResult.toolId);
        tools.push(result.toolResult);
      }
    }
  }
  return tools;
}

/** Builds the per-agent context block for the prompt. */
function buildAgentBlocks(results: AgentResult[]): string {
  const blocks: string[] = [];

  for (const result of results) {
    const agent = getAgent(result.agentId);
    const sections: string[] = [];

    sections.push(`## ${agent.name} (${agent.icon})`);

    if (!result.success) {
      sections.push(
        `This agent could not complete its analysis. Error: ${result.error ?? "Unknown error"}`
      );
      blocks.push(sections.join("\n"));
      continue;
    }

    if (result.toolResult?.success && result.toolResult.output) {
      const label = result.toolResult.metadata?.label ?? result.toolResult.toolId;
      sections.push(`Tool used: ${label}`);
      sections.push(result.toolResult.output);
    }

    if (result.retrievedChunks.length > 0) {
      sections.push(`Knowledge retrieved by ${agent.name}:`);
      sections.push(buildKnowledgeContext(result.retrievedChunks));
    }

    if (result.liveContext) {
      sections.push(`Live information gathered by ${agent.name}:`);
      sections.push(result.liveContext);
    }

    blocks.push(sections.join("\n"));
  }

  return blocks.join("\n\n");
}

/** Builds the conversation history block. */
function buildHistoryBlock(history: ConversationHistoryEntry[]): string {
  if (history.length === 0) return "";
  const lines = history.map(
    (message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`
  );
  return ["Conversation history:", ...lines].join("\n");
}

/**
 * Synthesizes all agent outputs into a single final prompt.
 *
 * The prompt structure:
 *   1. System instruction (synthesizer role).
 *   2. Per-agent context blocks (deduplicated, merged).
 *   3. Conversation history.
 *   4. Uploaded file context.
 *   5. The user question.
 */
export function synthesize(input: SynthesizerInput): SynthesizerOutput {
  const { query, plan, agentResults, conversationHistory, fileContext } = input;

  const successful = agentResults.filter((result) => result.success);
  const chunks = dedupeChunks(agentResults);
  const tools = mergeToolResults(agentResults);
  const ragUsed = chunks.length > 0;

  const participatingAgents: AgentId[] = plan.agents.map((task) => task.agentId);
  const usedToolIds = tools.map((tool) => tool.toolId);
  const usedToolLabels = tools
    .map((tool) => tool.metadata?.label ?? tool.toolId)
    .filter(Boolean);

  const retrievedDocumentTitles = Array.from(
    new Set(chunks.map((chunk) => chunk.documentTitle))
  );
  const sourcePaths = Array.from(
    new Set(chunks.map((chunk) => chunk.sourcePath ?? chunk.source))
  );

  const systemInstruction = [
    "You are the Response Synthesizer for Digital Brain India.",
    "Multiple specialist agents have analyzed the user's question independently.",
    "Combine their findings into ONE clear, coherent, and complete answer.",
    "Remove duplicate information and merge related points.",
    "Preserve important facts, figures, and citations from the agent outputs.",
    "If an agent failed, note that its perspective is unavailable but continue with the others.",
    "Structure the answer with clear sections when the question spans multiple domains.",
    "Always cite sources when knowledge was retrieved.",
  ].join("\n");

  const agentBlocks = buildAgentBlocks(successful);
  const historyBlock = buildHistoryBlock(conversationHistory);

  const sections: string[] = [
    systemInstruction,
    agentBlocks,
    historyBlock,
    fileContext ? `Uploaded files:\n${fileContext}` : "",
    `User Question: ${query}`,
  ];

  const prompt = sections.filter(Boolean).join("\n\n");

  return {
    prompt,
    ragUsed,
    retrievedDocumentTitles,
    sourcePaths,
    participatingAgents,
    usedToolIds,
    usedToolLabels,
  };
}

/** Builds a single-agent prompt (fast path, backward compatible). */
export function buildSingleAgentPrompt(input: {
  agent: { id: AgentId; name: string; icon: string };
  message: string;
  retrievedChunks: RetrievedChunk[];
  liveContext: string;
  fileContext: string;
  conversationHistory: ConversationHistoryEntry[];
  toolResult: ToolResult | null;
}): SynthesizerOutput {
  const agent = getAgent(input.agent.id);
  const result: AgentResult = {
    agentId: input.agent.id,
    agentName: agent.name,
    agentIcon: agent.icon,
    success: true,
    retrievedChunks: input.retrievedChunks,
    toolResult: input.toolResult,
    usedToolId: input.toolResult?.toolId ?? null,
    liveContext: input.liveContext,
    executionTime: 0,
  };

  const plan: ExecutionPlan = {
    query: input.message,
    agents: [{
      agentId: input.agent.id,
      agentName: agent.name,
      agentIcon: agent.icon,
      reason: "Single-agent fast path",
      categories: agent.supportedCategories,
    }],
    mode: "parallel",
    isSingleAgent: true,
    isGeneralOnly: input.agent.id === "general",
    summary: `Using ${agent.name} for this query.`,
  };

  return synthesize({
    query: input.message,
    plan,
    agentResults: [result],
    conversationHistory: input.conversationHistory,
    fileContext: input.fileContext,
  });
}