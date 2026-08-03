import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GoogleGenAI, ApiError } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { createId } from "@/lib/chatStorage";
import {
  encodeConversationMeta,
  encodeMessageEntry,
  getConversationFiles,
} from "@/lib/chatPersistence";
import { searchKnowledge } from "@/lib/ai/rag";
import { buildChatPrompt, type ConversationHistoryMessage } from "@/lib/ai/promptBuilder";
import type { RetrievedChunk } from "@/lib/ai/search";
import { searchLiveWeb } from "@/lib/liveIntelligence";
import { getAgent } from "@/lib/agents";
import { buildMultimodalPrompt, parseImageAttachment } from "@/lib/multimodal";
import { sanitizeTextInput } from "@/lib/sanitize";
import { logError } from "@/lib/logger";
import { addMessage, listMessages } from "@/lib/conversations";

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

    const agentDefinition = getAgent(agent);
    const fileEntries = await getConversationFiles(session.user.id, conversation);
    const fileContext = fileEntries
      .map((entry) => `File: ${entry.fileName}\n${entry.text}`)
      .join("\n\n---\n\n");
    const searchResult = await searchKnowledge(incomingMessage, { topK: 4 });
    const retrievedChunks: RetrievedChunk[] = searchResult.chunks;
    const liveInfo = await searchLiveWeb(incomingMessage);
    const imagePayload = parseImageAttachment(image);

    // Load recent conversation history (Phase 4). If it fails, the chat
    // continues normally with an empty history (see loadRecentHistory).
    const conversationHistory = await loadRecentHistory(
      session.user.id,
      conversation,
      20
    );

    // Prompt assembly is delegated to the prompt builder so the route stays
    // free of retrieval/formatting concerns. When no chunks are found the
    // builder produces a normal chat prompt (RAG block omitted).
    const { prompt, ragUsed } = buildChatPrompt({
      agent: agentDefinition,
      message: incomingMessage,
      retrievedChunks,
      liveContext:
        liveInfo.shouldUseLiveInfo && liveInfo.context ? liveInfo.context : "",
      fileContext,
      conversationHistory,
    });

    const multimodalPayload = buildMultimodalPrompt(prompt, imagePayload);
    const encoder = new TextEncoder();
    let generator: AsyncGenerator<any, any, any> | null = null;
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
            const text = typeof chunk?.text === "function" ? chunk.text() : (chunk?.text || "");
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

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "done",
                reply: finalReply,
                conversationId: conversation,
                retrievedDocumentTitles: retrievedChunks.map((c) => c.documentTitle),
                sourcePaths: retrievedChunks.map((c) => c.sourcePath ?? c.source),
                ragUsed,
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