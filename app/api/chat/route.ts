import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GoogleGenAI } from "@google/genai";
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

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? "",
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { message, conversationId, conversationTitle, agent } = await req.json();

    if (!message || typeof message !== "string") {
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
        ? encodeConversationMeta(conversation, conversationTitle, message)
        : encodeMessageEntry(conversation, message);

    const agentDefinition = getAgent(agent);
    const fileEntries = await getConversationFiles(session.user.id, conversation);
    const fileContext = fileEntries
      .map((entry) => `File: ${entry.fileName}\n${entry.text}`)
      .join("\n\n---\n\n");
    const knowledgeContext = await buildKnowledgeContext(message, 4);
    const liveInfo = await searchLiveWeb(message);
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
      `Question: ${message}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const encoder = new TextEncoder();
    let generator: AsyncGenerator<any, any, any> | null = null;
    let finalReply = "";
    let streamError: string | null = null;

    const stream = new ReadableStream({
      async start(controller) {
        async function createGenerator(model: string) {
          return ai.models.generateContentStream({
            model,
            contents: prompt,
          });
        }

        try {
          generator = await createGenerator("gemini-2.0-flash");
        } catch (error) {
          console.warn(
            "Primary model unavailable, falling back to gemini-1.5-flash",
            error
          );
          try {
            generator = await createGenerator("gemini-1.5-flash");
          } catch (fallbackError) {
            streamError =
              "Unable to stream from Gemini. Please try again later.";
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
        }

        if (!generator) {
          controller.enqueue(
            encoder.encode(
              JSON.stringify({
                type: "error",
                error: "Unable to initialize Gemini stream.",
              }) + "\n"
            )
          );
          controller.close();
          return;
        }

        try {
          for await (const chunk of generator) {
            const text = typeof chunk?.text === "string" ? chunk.text : "";
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
          console.error("Chat stream error:", error);
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
    console.error("Chat API error:", error);

    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}
