import { parseVisionRequestBody } from "../../lib/sheet-vision-parse.ts";
import { sheetVisionRateLimitKv } from "../../lib/sheet-vision-env.ts";
import { consumeSheetVisionRateLimit, hourlyLimitFromEnv } from "../../lib/sheet-vision-ratelimit.ts";
import { recognizeWithVisionProvider, resolveSheetVisionProvider } from "../../lib/sheet-vision-provider.ts";
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

  const rateKv = sheetVisionRateLimitKv();
  if (rateKv) {
    const limited = await consumeSheetVisionRateLimit(rateKv, request, hourlyLimitFromEnv());
    if (!limited.ok) {
      return Response.json(
        {
          ok: false,
          reason: `Enhanced read limit reached (${hourlyLimitFromEnv()} per hour). Try on-device scan or wait a bit.`,
          status: 429,
        },
        {
          status: 429,
          headers: { "retry-after": String(limited.retryAfterSeconds) },
        },
      );
    }
  }

  const resolved = resolveSheetVisionProvider();
  if (!resolved) {
    return Response.json(
      { ok: false, reason: "Vision API not configured on the server." },
      { status: 503 },
    );
  }

  // TODO: verify turnstileToken when TURNSTILE_SECRET_KEY is set
  // TODO: KV daily quota (SHEET_VISION_DAILY_CAP)

  const result = await recognizeWithVisionProvider(parsed.request, resolved);
  if (!result.ok) {
    return Response.json(result, { status: 422 });
  }
  return Response.json(result);
}

export function GET() {
  return Response.json({ error: "method not allowed" }, { status: 405, headers: { allow: "POST" } });
}
