import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { GoogleGenAI } from "@google/genai";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

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

    const { message } = await req.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

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

    const chat = await prisma.chat.create({
      data: {
        message,
        reply,
        userId: session.user.id,
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
