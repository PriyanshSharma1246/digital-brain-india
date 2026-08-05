import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GoogleGenAI, ApiError, GenerateContentResponse } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { createId } from "@/lib/chatStorage";
import {
  encodeConversationMeta,
  encodeMessageEntry,
  getConversationFiles,
} from "@/lib/chatPersistence";
import { buildChatPrompt, buildMultiAgentChatPrompt, type ConversationHistoryMessage } from "@/lib/ai/promptBuilder";
import type { RetrievedChunk } from "@/lib/ai/search";
import { getAgent, type AgentId } from "@/lib/agents";
import { buildMultimodalPrompt, parseImageAttachment } from "@/lib/multimodal";
import { sanitizeTextInput } from "@/lib/sanitize";
import { logError } from "@/lib/logger";
import { addMessage, listMessages } from "@/lib/conversations";
import {
  planQuery,
  executePlan,
  executeSingleAgent,
  synthesize,
} from "@/lib/planner";
import type { AgentExecutionContext, AgentResult } from "@/lib/planner";

/**
 * Extracts a human-readable error message from a thrown value.
 * Handles the SDK's ApiError (which carries an HTTP status) and generic Errors.
 */
function extractApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return `Gemini API Error (status ${error.status}): ${error.message}`;
  }
  if (error instanceof Error) {
    return `Gemini API Error: ${error.message}`;
  }
  return `Gemini API Error: ${String(error)}`;
}

/**
 * Loads the most recent conversation history for prompt assembly.
 *
 * Uses the Phase 4 conversation service (lib/conversations.ts) to fetch the
 * latest messages in chronological order. Error messages are excluded, and
 * only the newest `limit` messages are kept to stay within the model's
 * context window. If history cannot be loaded, an empty array is returned so
 * the chat continues normally (per the error-handling requirement).
 */
async function loadRecentHistory(
  userId: string,
  conversationId: string,
  limit = 20
): Promise<ConversationHistoryMessage[]> {
  try {
    // Fetch the last page of messages (newest first via offset pagination).
    // We request a large page size and then slice the newest `limit` messages
    // to keep the prompt compact.
    const page = await listMessages(userId, conversationId, {
      page: 1,
      pageSize: Math.max(limit, 50),
    });
    if (!page) return [];

    return page.messages
      .filter((message) => !message.isError)
      .slice(-limit)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));
  } catch (error) {
    logError("Failed to load conversation history", {
      userId,
      conversationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

export async function POST(req: Request) {
  try {
    // 1. Check API Key
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("API Key Loaded: false - GEMINI_API_KEY is missing in environment.");
      return NextResponse.json(
        { success: false, error: "Server Configuration Error: API key missing." },
        { status: 500 }
      );
    }

    // Validate the API key format. Google AI Studio Gemini API keys start with
    // either "AIza" (legacy format, ~39 characters) or "AQ." (new format).
    if (!/^(AIza[0-9A-Za-z_-]{35}|AQ\.[0-9A-Za-z_-]{10,})$/.test(apiKey)) {
      console.error(
        "API Key Loaded: true but INVALID FORMAT. " +
        "Gemini API keys must start with 'AIza' or 'AQ.'. " +
        "Current key starts with: " + apiKey.slice(0, 4) + "..."
      );
      return NextResponse.json(
        {
          success: false,
          error:
            "Server Configuration Error: GEMINI_API_KEY has an invalid format. " +
            "Get a valid key from https://aistudio.google.com/apikey (it should start with 'AIza' or 'AQ.').",
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // 2. Auth Check
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { message, conversationId, conversationTitle, agent, image } = await req.json();
    const incomingMessage = sanitizeTextInput(typeof message === "string" ? message : "", { maxLength: 4000 });
    const hasImage = Boolean(
      typeof image === "string" && image.startsWith("data:image/")
    );

    if (!incomingMessage.trim() && !hasImage) {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    const conversation =
      typeof conversationId === "string" && conversationId
        ? conversationId
        : `conv:${createId()}`;

    const encodedMessage =
      conversationTitle && conversationTitle !== "New chat"
        ? encodeConversationMeta(conversation, conversationTitle, incomingMessage || "[Image attached]")
        : encodeMessageEntry(conversation, incomingMessage || "[Image attached]");

    // Phase 8 — Planner. The planner analyzes the query and decides which
    // agents should run, and whether they run in parallel or sequentially.
    // When the client explicitly overrides the agent, the planner uses the
    // single-agent fast path (backward compatible with Phase 6).
    const manualAgent = typeof agent === "string" && agent ? (agent as AgentId) : null;
    const plan = planQuery(incomingMessage, { manualAgent });

    // Load shared context for all agents.
    const fileEntries = await getConversationFiles(session.user.id, conversation);
    const fileContext = fileEntries
      .map((entry) => `File: ${entry.fileName}\n${entry.text}`)
      .join("\n\n---\n\n");

    // Load recent conversation history (Phase 4). If it fails, the chat
    // continues normally with an empty history (see loadRecentHistory).
    const conversationHistory = await loadRecentHistory(
      session.user.id,
      conversation,
      20
    );

    const imagePayload = parseImageAttachment(image);

    const agentContext: AgentExecutionContext = {
      message: incomingMessage,
      conversationHistory,
      fileContext,
      liveContext: "",
      imagePayload,
    };

    // Phase 8 — Executor. Run all selected agents. Single-agent plans use
    // the existing optimized flow (executeSingleAgent). Multi-agent plans
    // run in parallel via Promise.all() inside executePlan.
    let agentResults: AgentResult[];
    if (plan.isSingleAgent) {
      const singleResult = await executeSingleAgent(plan.agents[0].agentId, agentContext);
      agentResults = [singleResult];
    } else {
      const execution = await executePlan(plan, agentContext);
      agentResults = execution.agentResults;
    }

    // Phase 8 — Synthesizer. Combine all agent outputs into one final prompt.
    // The synthesizer deduplicates RAG chunks, merges tool results, and
    // preserves citations.
    const synthesizerOutput = synthesize({
      query: incomingMessage,
      plan,
      agentResults,
      conversationHistory,
      fileContext,
    });

    // Build the final prompt. Multi-agent plans use the synthesizer prompt;
    // single-agent plans use the existing optimized prompt builder for full
    // backward compatibility.
    let prompt: string;
    let ragUsed: boolean;
    let retrievedChunks: RetrievedChunk[] = [];
    let usedToolId: string | null = null;
    let usedToolLabel: string | null = null;

    if (plan.isSingleAgent) {
      const agentDefinition = getAgent(plan.agents[0].agentId);
      const singleResult = agentResults[0];
      retrievedChunks = singleResult?.retrievedChunks ?? [];
      usedToolId = singleResult?.usedToolId ?? null;
      usedToolLabel = singleResult?.toolResult?.metadata?.label ?? null;

      const built = buildChatPrompt({
        agent: agentDefinition,
        message: incomingMessage,
        retrievedChunks,
        liveContext: singleResult?.liveContext ?? "",
        fileContext,
        conversationHistory,
        toolResult: singleResult?.toolResult ?? null,
      });
      prompt = built.prompt;
      ragUsed = built.ragUsed;
    } else {
      const built = buildMultiAgentChatPrompt(synthesizerOutput);
      prompt = built.prompt;
      ragUsed = built.ragUsed;
      retrievedChunks = agentResults.flatMap((result) => result.retrievedChunks);
      const successfulTools = agentResults
        .filter((result) => result.toolResult?.success)
        .map((result) => result.toolResult!);
      usedToolId = successfulTools[0]?.toolId ?? null;
      usedToolLabel = successfulTools[0]?.metadata?.label ?? null;
    }

    const multimodalPayload = buildMultimodalPrompt(prompt, imagePayload);
    const encoder = new TextEncoder();
    let generator: AsyncGenerator<GenerateContentResponse> | null = null;
    let finalReply = "";
    let streamError: string | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        async function createGenerator(model: string) {
          return ai.models.generateContentStream({
            model,
            contents: [
              {
                role: "user",
                parts: multimodalPayload.parts,
              },
            ],
          });
        }

        // Try candidate models in order until one initializes. Newer "AQ."
        // keys may no longer have access to older models (e.g.
        // gemini-2.5-flash returns 404 "no longer available to new users",
        // gemini-2.0-flash may return 429 quota exhaustion).
        const candidateModels = [
          "gemini-3-flash-preview",
          "gemini-2.5-flash",
          "gemini-2.0-flash",
        ];
        let initErrorDetails: string | null = null;

        for (const model of candidateModels) {
          try {
            generator = await createGenerator(model);
            break;
          } catch (error) {
            initErrorDetails = extractApiError(error);
            console.warn(
              `Model "${model}" failed, attempting next model...\n${initErrorDetails}`
            );
          }
        }

        if (!generator) {
          const errorDetails =
            initErrorDetails ?? "Unable to initialize Gemini stream.";
          console.error(`Gemini API stream init failed:\n${errorDetails}`);
          logError("Gemini API stream init failed", {
            userId: session.user.id,
            conversationId: conversation,
            error: errorDetails,
          });
          streamError =
            "Unable to stream from Gemini: the configured models are " +
            "unavailable for this API key or the quota has been exceeded. " +
            "Please check your plan/billing or try again later.";
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: streamError,
              }) + "\n"
            )
          );
          controller.close();
          return;
        }

        try {
          for await (const chunk of generator) {
            // `text` is a getter property on GenerateContentResponse in @google/genai v2.x
            const text = chunk.text || "";
            if (!text) continue;
            finalReply += text;
            controller.enqueue(
              encoder.encode(
                JSON.stringify({ type: "chunk", text }) + "\n"
              )
            );
          }

          if (!finalReply) {
            finalReply = "No response from Gemini.";
          }

          await prisma.chat.create({
            data: {
              message: encodedMessage,
              reply: finalReply,
              userId: session.user.id,
            },
          });

          // Persist the turn to the Phase 4 conversation memory. The user
          // message and assistant reply are saved as separate Message rows so
          // the conversation history can be replayed on future turns. Failures
          // here are non-fatal — the streamed reply is still delivered.
          try {
            await addMessage(
              session.user.id,
              conversation,
              "user",
              incomingMessage || "[Image attached]"
            );
            await addMessage(session.user.id, conversation, "assistant", finalReply);
          } catch (historyError) {
            logError("Failed to persist conversation messages", {
              userId: session.user.id,
              conversationId: conversation,
              error:
                historyError instanceof Error
                  ? historyError.message
                  : String(historyError),
            });
          }

          // Phase 8 — the done event now includes all participating agents,
          // their names/icons, and all tool usage across agents.
          const participatingAgents = plan.agents.map((task) => task.agentId);
          const agentNames = plan.agents.map((task) => task.agentName);
          const agentIcons = plan.agents.map((task) => task.agentIcon);
          const usedToolIds = agentResults
            .filter((result) => result.usedToolId)
            .map((result) => result.usedToolId as string);
          const usedToolLabels = agentResults
            .filter((result) => result.toolResult?.metadata?.label)
            .map((result) => result.toolResult!.metadata!.label as string);

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "done",
                reply: finalReply,
                conversationId: conversation,
                retrievedDocumentTitles: synthesizerOutput.retrievedDocumentTitles,
                sourcePaths: synthesizerOutput.sourcePaths,
                ragUsed,
                agent: participatingAgents[0] ?? "general",
                agentName: agentNames[0] ?? "General Assistant",
                agentIcon: agentIcons[0] ?? "🤖",
                routed: !plan.isGeneralOnly,
                agents: participatingAgents,
                agentNames,
                agentIcons,
                // Phase 7 — tool usage indicator. Present only when a tool
                // executed successfully so the UI can show e.g. "🧮 Calculator".
                usedToolId: usedToolId,
                usedToolLabel: usedToolLabel,
                usedToolIds,
                usedToolLabels,
              }) + "\n"
            )
          );
        } catch (error) {
          const streamErrorDetails = extractApiError(error);
          console.error(`Stream reading error:\n${streamErrorDetails}`);
          logError("Chat stream error", {
            userId: session.user.id,
            conversationId: conversation,
            error: streamErrorDetails,
          });
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: "Stream interrupted. Please try again.",
              }) + "\n"
            )
          );
        } finally {
          controller.close();
        }
      },
      cancel() {
        const activeGenerator = generator;
        if (activeGenerator && typeof activeGenerator.return === "function") {
          void activeGenerator.return({});
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const errorDetails = extractApiError(error);
    console.error(`Chat API error:\n${errorDetails}`);

    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}