import { recognizeWithOpenAI } from "../../lib/sheet-vision-openai.ts";
import { parseVisionRequestBody } from "../../lib/sheet-vision-parse.ts";
import { SHEET_VISION_MAX_BODY_BYTES, SHEET_VISION_MAX_IMAGE_BYTES } from "../../lib/sheet-vision-types.ts";

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > SHEET_VISION_MAX_BODY_BYTES) {
    return Response.json({ ok: false, reason: "payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, reason: "invalid json" }, { status: 400 });
  }

  const parsed = parseVisionRequestBody(body, SHEET_VISION_MAX_IMAGE_BYTES);
  if (!parsed.ok) {
    return Response.json({ ok: false, reason: parsed.error }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { ok: false, reason: "Vision API not configured on the server." },
      { status: 503 },
    );
  }

  // TODO: verify turnstileToken when TURNSTILE_SECRET_KEY is set
  // TODO: KV daily quota (SHEET_VISION_DAILY_CAP)

  const result = await recognizeWithOpenAI(parsed.request, apiKey);
  if (!result.ok) {
    return Response.json(result, { status: 422 });
  }
  return Response.json(result);
}

export function GET() {
  return Response.json({ error: "method not allowed" }, { status: 405, headers: { allow: "POST" } });
}
