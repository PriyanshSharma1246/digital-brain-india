export type ChatImageAttachment = {
  dataUrl: string;
  mimeType: string;
  fileName: string;
  base64: string;
};

export function parseImageAttachment(input: unknown): ChatImageAttachment | null {
  if (typeof input !== "string" || !input.startsWith("data:")) {
    return null;
  }

  const match = input.match(/^data:(image\/([a-zA-Z0-9.+-]+));base64,(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    dataUrl: input,
    mimeType: match[1],
    fileName: "uploaded-image",
    base64: match[3],
  };
}

export function buildMultimodalPrompt(message: string, image?: ChatImageAttachment | null) {
  const instructions = [
    "You are analyzing an uploaded image in the India Digital Brain chat experience.",
    "Describe the image clearly and concisely.",
    "If the image contains readable text, transcribe it accurately.",
    "If it contains a document, screenshot, chart, or form, summarize the most important details.",
  ];

  const promptText = [
    ...instructions,
    message ? `User request: ${message}` : "User request: Please analyze this image.",
  ].join("\n");

  if (!image) {
    return {
      promptText,
      parts: [{ text: promptText }],
    };
  }

  return {
    promptText,
    parts: [
      {
        text: promptText,
      },
      {
        inlineData: {
          mimeType: image.mimeType,
          data: image.base64,
        },
      },
    ],
  };
}
