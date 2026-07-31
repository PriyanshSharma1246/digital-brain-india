import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";

// Initialize the Gemini client once (API key from .env.local)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY ?? "",
});

// The test user ID used to persist chats (from .env.local)
const TEST_USER_ID = process.env.TEST_USER_ID ?? "";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    if (!TEST_USER_ID) {
      return NextResponse.json(
        { success: false, error: "TEST_USER_ID is not configured" },
        { status: 500 }
      );
    }

    // Send the user's message to Gemini 2.0 Flash
    // Falls back to gemini-1.5-flash if 2.0 quota is exhausted
    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: message,
      });
    } catch {
      console.log("Primary model unavailable, falling back to gemini-1.5-flash");
      response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: message,
      });
    }

    const reply = response.text ?? "No response from Gemini.";

    // Save the user message and AI reply to the Chat table
    const chat = await prisma.chat.create({
      data: {
        message,
        reply,
        userId: TEST_USER_ID,
      },
    });

    return NextResponse.json({
      success: true,
      reply,
      chatId: chat.id,
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { success: false, error: "Server error" },
      { status: 500 }
    );
  }
}