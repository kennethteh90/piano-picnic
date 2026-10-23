import { parseVisionModelPayload } from "./sheet-vision-parse.ts";
import type { SheetVisionRequest, SheetVisionResult } from "./sheet-vision-types.ts";

const SYSTEM = `You read simple piano grand-staff images. Return JSON only, no markdown.
Schema: { "events": [ { "treble": [{ "note": "E4", "staccato"?: true, "tiedToNext"?: true, ... }], "bass": [...] } ] }
Notes are spelled like C4, F#4, Bb3. Order events left-to-right in time. Chords share one event with multiple pitches in treble or bass.`;

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
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "List note events on this grand staff for playback in C major / common accidentals." },
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
