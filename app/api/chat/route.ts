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
import { buildKnowledgeContext } from "@/lib/rag";
import { searchLiveWeb } from "@/lib/liveIntelligence";
import { getAgent } from "@/lib/agents";
import { buildMultimodalPrompt, parseImageAttachment } from "@/lib/multimodal";
import { sanitizeTextInput } from "@/lib/sanitize";
import { logError } from "@/lib/logger";

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
    const knowledgeContext = await buildKnowledgeContext(incomingMessage, 4);
    const liveInfo = await searchLiveWeb(incomingMessage);
    const imagePayload = parseImageAttachment(image);

    const prompt = [
      `System role: ${agentDefinition.systemPrompt}`,
      knowledgeContext
        ? `You are India Digital Brain, an expert assistant for Indian public services, education, healthcare, agriculture, economy, startups, and laws. Use the retrieved knowledge below before answering.\n\nKnowledge sources:\n${knowledgeContext}`
        : "",
      liveInfo.shouldUseLiveInfo && liveInfo.context
        ? `Use the live information below when the question requires current or recent data. Include source links in the answer.\n\nLive information:\n${liveInfo.context}`
        : "",
      fileContext
        ? `Uploaded files:\n${fileContext}`
        : "",
      `Question: ${incomingMessage || "Please analyze the uploaded image."}`,
    ]
      .filter(Boolean)
      .join("\n\n");

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

          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "done",
                reply: finalReply,
                conversationId: conversation,
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