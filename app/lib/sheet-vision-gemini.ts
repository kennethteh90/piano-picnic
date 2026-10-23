import { parseVisionModelPayload } from "./sheet-vision-parse.ts";
import { SHEET_VISION_SYSTEM, SHEET_VISION_USER } from "./sheet-vision-prompt.ts";
import type { SheetVisionRequest, SheetVisionResult } from "./sheet-vision-types.ts";

const DEFAULT_MODEL = "gemini-2.0-flash";

function geminiModelId() {
  const fromEnv = process.env.GEMINI_MODEL?.trim();
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_MODEL;
}

export async function recognizeWithGemini(request: SheetVisionRequest, apiKey: string): Promise<SheetVisionResult> {
  const model = geminiModelId();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SHEET_VISION_SYSTEM }] },
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens: 1200,
        temperature: 0.2,
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: SHEET_VISION_USER },
            {
              inlineData: {
                mimeType: request.mime,
                data: request.image,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return { ok: false, reason: "Gemini rejected the request. Check billing and API key." };
  }

  const payload = await response.json() as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
  if (!content) return { ok: false, reason: "Empty Gemini response." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, reason: "Gemini response was not JSON." };
  }

  const events = parseVisionModelPayload(parsed);
  if (!events.ok) return { ok: false, reason: events.error };

  return {
    ok: true,
    events: events.events,
    pages: request.pages ?? 1,
    source: "vision",
  };
}
