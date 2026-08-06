import type { RetrievedChunk } from "./search";
import { buildKnowledgeContext } from "./rag";
import type { AgentDefinition } from "@/lib/agents";
import type { ToolResult } from "@/lib/tools";
import type { ConnectorResult } from "@/lib/connectors/types";
import { formatConnectorResults } from "@/lib/connectors/formatter";
import type { SynthesizerOutput } from "@/lib/planner";

/**
 * Prompt construction for the RAG-augmented chat flow.
 *
 * This module keeps the retrieval-aware prompt assembly separate from the
 * Gemini streaming logic in `app/api/chat/route.ts`. The route only needs to
 * call `buildChatPrompt()` with the retrieved chunks and context inputs; it
 * never has to know how the knowledge block is formatted.
 *
 * Phase 6 — the prompt builder now injects the agent identity, system prompt,
 * and agent capabilities before the conversation history, so the model always
 * knows which specialist agent is answering.
 *
 * Phase 7 — the prompt builder now supports an optional Tool Results block
 * injected between the agent prompt and the RAG context, so the model sees
 * tool output before knowledge retrieval.
 *
 * Phase 8 — the prompt builder now supports multi-agent orchestration via
 * `buildMultiAgentChatPrompt()`, which accepts the synthesizer output
 * (planner output + multiple agent outputs + merged tool results + RAG
 * context + conversation history + user message) and produces the final
 * prompt. The existing `buildChatPrompt()` remains for backward
 * compatibility with the single-agent fast path.
 */

/** A single message from the persistent conversation history. */
export interface ConversationHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

/** Inputs needed to assemble the final prompt sent to Gemini. */
export interface ChatPromptInput {
  /** The active agent definition (provides the system role). */
  agent: AgentDefinition;
  /** The sanitized user message (may be empty for image-only turns). */
  message: string;
  /** Chunks retrieved from the knowledge base (empty when RAG found nothing). */
  retrievedChunks: RetrievedChunk[];
  /** Live web search context (empty string when not applicable). */
  liveContext: string;
  /** Uploaded file text context (empty string when no files). */
  fileContext: string;
  /**
   * Recent conversation history in chronological order (oldest first).
   * Error messages are excluded by the caller. Empty when no history exists.
   */
  conversationHistory?: ConversationHistoryMessage[];
  /**
   * Phase 7 — Optional tool result from a tool execution.
   * When present, the tool output is injected into the prompt above the RAG
   * context so the model sees the tool result before the knowledge base.
   */
  toolResult?: ToolResult | null;
  /**
   * Phase 10 — Optional government data connector results.
   * When present, the live data block is injected into the prompt between
   * the Tool Results section and the RAG context.
   */
  connectorResults?: ConnectorResult[] | null;
}

/** The assembled prompt plus a flag indicating whether RAG context was used. */
export interface ChatPromptResult {
  /** The full prompt string ready to be passed to Gemini. */
  prompt: string;
  /** True when retrieved chunks were injected into the prompt. */
  ragUsed: boolean;
}

/**
 * Builds the agent identity + capabilities block.
 *
 * This is injected before the conversation history so the model always knows
 * which specialist agent is answering, what it can do, and which knowledge
 * sources it prefers.
 */
function buildAgentBlock(agent: AgentDefinition): string {
  const capabilities = agent.enabledTools
    .map((tool) => {
      switch (tool) {
        case "rag":
          return "Retrieve answers from the Digital Brain India knowledge base";
        case "live-web":
          return "Use live web information for current or recent data";
        case "file-context":
          return "Read and answer from uploaded files";
        case "image-analysis":
          return "Analyze uploaded images";
        default:
          return "";
      }
    })
    .filter(Boolean);

  const sections = [
    `You are ${agent.name} (${agent.icon}) for Digital Brain India.`,
    agent.systemPrompt,
    `Your capabilities: ${capabilities.join("; ")}.`,
  ];

  if (agent.preferredKnowledgeSources.length > 0) {
    sections.push(
      `Preferred knowledge sources: ${agent.preferredKnowledgeSources.join(", ")}.`
    );
  }

  return sections.join("\n");
}

/**
 * Builds the RAG-aware system instruction block.
 *
 * When chunks are present, the model is told to answer from the knowledge
 * first and to fall back to general knowledge only when the answer is not
 * contained in the retrieved context. When no chunks are found, an empty
 * string is returned so the caller can skip the block entirely.
 */
function buildRagInstruction(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  const knowledgeBlock = buildKnowledgeContext(chunks);

  return [
    "Answer using the provided knowledge first.",
    "",
    "Knowledge:",
    knowledgeBlock,
    "",
    "If the answer is not contained in the knowledge, clearly state that and then answer using general knowledge.",
  ].join("\n");
}

/**
 * Formats the recent conversation history into a compact prompt block.
 *
 * Messages are rendered oldest-first so the model sees the conversation in
 * chronological order. Error messages are expected to be filtered out by the
 * caller before this function is invoked.
 */
function buildHistoryBlock(history: ConversationHistoryMessage[]): string {
  if (history.length === 0) return "";

  const lines = history.map(
    (message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`
  );

  return ["Conversation history:", ...lines].join("\n");
}

/**
 * Builds the Phase 7 Tool Results block.
 *
 * Successful tool output is injected so the model can reference the computed
 * result while answering. Failed tool executions are skipped entirely — the
 * chat proceeds normally without the tool output (per the error-handling
 * requirement).
 */
function buildToolResultsBlock(toolResult: ToolResult | null | undefined): string {
  if (!toolResult || !toolResult.success || !toolResult.output) return "";

  const label = toolResult.metadata?.label ?? toolResult.toolId;
  return [
    `Tool used: ${label}`,
    toolResult.output,
  ].join("\n");
}

/**
 * Phase 10 — Builds the Live Government Data block.
 *
 * Successful connector output is injected into the prompt between the
 * Tool Results section and the RAG context so the model sees live
 * government data before the knowledge base. Failed connector
 * executions are skipped entirely — the chat proceeds normally without
 * the connector output (per the error-handling requirement).
 */
function buildConnectorResultsBlock(
  connectorResults: ConnectorResult[] | null | undefined
): string {
  return formatConnectorResults(connectorResults);
}

/**
 * Builds the final prompt sent to Gemini.
 *
 * The prompt is assembled from (in order):
 *   1. The agent identity, system prompt, and capabilities.
 *   2. The Tool Results block (only when a tool executed successfully).
 *   3. The RAG knowledge block (only when chunks were retrieved).
 *   4. The live web context (only when relevant).
 *   5. The uploaded file context (only when files exist).
 *   6. Recent conversation history (only when available).
 *   7. The user question (or an image-analysis instruction).
 *
 * Empty sections are filtered out so the prompt stays compact.
 */
export function buildChatPrompt(input: ChatPromptInput): ChatPromptResult {
  const ragUsed = input.retrievedChunks.length > 0;
  const agentBlock = buildAgentBlock(input.agent);
  const toolResultsBlock = buildToolResultsBlock(input.toolResult);
  const connectorResultsBlock = buildConnectorResultsBlock(input.connectorResults);
  const ragInstruction = buildRagInstruction(input.retrievedChunks);
  const historyBlock = buildHistoryBlock(input.conversationHistory ?? []);

  const sections: string[] = [
    agentBlock,
    toolResultsBlock,
    connectorResultsBlock,
    ragInstruction,
    input.liveContext
      ? `Use the live information below when the question requires current or recent data. Include source links in the answer.\n\nLive information:\n${input.liveContext}`
      : "",
    input.fileContext ? `Uploaded files:\n${input.fileContext}` : "",
    historyBlock,
    `User Question: ${input.message || "Please analyze the uploaded image."}`,
  ];

  const prompt = sections.filter(Boolean).join("\n\n");

  return { prompt, ragUsed };
}

/**
 * Phase 8 — Builds the final prompt for the multi-agent orchestration flow.
 *
 * Accepts the synthesizer output (which already contains the planner output,
 * multiple agent outputs, merged tool results, RAG context, conversation
 * history, and the user message) and returns the final prompt ready for
 * Gemini. This is the primary entry point for the Planner → Executor →
 * Synthesizer pipeline.
 */
export function buildMultiAgentChatPrompt(
  synthesizerOutput: SynthesizerOutput
): ChatPromptResult {
  return {
    prompt: synthesizerOutput.prompt,
    ragUsed: synthesizerOutput.ragUsed,
  };
}