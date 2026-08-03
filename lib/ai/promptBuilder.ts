import type { RetrievedChunk } from "./search";
import { buildKnowledgeContext } from "./rag";
import type { AgentDefinition } from "@/lib/agents";

/**
 * Prompt construction for the RAG-augmented chat flow.
 *
 * This module keeps the retrieval-aware prompt assembly separate from the
 * Gemini streaming logic in `app/api/chat/route.ts`. The route only needs to
 * call `buildChatPrompt()` with the retrieved chunks and context inputs; it
 * never has to know how the knowledge block is formatted.
 *
 * When the vector backend is wired in a later phase, only the retrieval
 * modules change — this prompt builder (and the route) stay untouched.
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
}

/** The assembled prompt plus a flag indicating whether RAG context was used. */
export interface ChatPromptResult {
  /** The full prompt string ready to be passed to Gemini. */
  prompt: string;
  /** True when retrieved chunks were injected into the prompt. */
  ragUsed: boolean;
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
    "You are Digital Brain India, an expert assistant for Indian public services, education, healthcare, agriculture, economy, startups, and laws.",
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
 * Builds the final prompt sent to Gemini.
 *
 * The prompt is assembled from (in order):
 *   1. The agent's system role.
 *   2. The RAG knowledge block (only when chunks were retrieved).
 *   3. The live web context (only when relevant).
 *   4. The uploaded file context (only when files exist).
 *   5. Recent conversation history (only when available).
 *   6. The user question (or an image-analysis instruction).
 *
 * Empty sections are filtered out so the prompt stays compact.
 */
export function buildChatPrompt(input: ChatPromptInput): ChatPromptResult {
  const ragUsed = input.retrievedChunks.length > 0;
  const ragInstruction = buildRagInstruction(input.retrievedChunks);
  const historyBlock = buildHistoryBlock(input.conversationHistory ?? []);

  const sections: string[] = [
    `System role: ${input.agent.systemPrompt}`,
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
