import { parseVisionModelPayload } from "./sheet-vision-parse.ts";
import { SHEET_VISION_SYSTEM, SHEET_VISION_USER } from "./sheet-vision-prompt.ts";
import type { SheetVisionRequest, SheetVisionResult } from "./sheet-vision-types.ts";

export async function recognizeWithOpenAI(request: SheetVisionRequest, apiKey: string): Promise<SheetVisionResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SHEET_VISION_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: SHEET_VISION_USER },
            {
              type: "image_url",
              image_url: { url: `data:${request.mime};base64,${request.image}`, detail: "low" },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return { ok: false, reason: "Vision provider rejected the request." };
  }

  const payload = await response.json() as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return { ok: false, reason: "Empty vision response." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return { ok: false, reason: "Vision response was not JSON." };
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
