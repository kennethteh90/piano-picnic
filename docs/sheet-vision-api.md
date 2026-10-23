# Sheet vision API (LLM)

## Cursor subscription vs production vision

**A Cursor subscription (Pro, Ultra, etc.) is not an HTTP API for your live site.**

| What | Pays for | Usable from `piano.codingagents.cc`? |
|------|----------|-------------------------------------|
| Cursor subscription | Agent, chat, and edits inside the Cursor IDE | **No** — no key you can call from Workers |
| OpenAI / Anthropic / Google API | Per-token usage on the provider account | **Yes** — via a server-side proxy |
| Cloudflare Workers AI | Usage on your Cloudflare account | **Yes** — same Worker, different binding |

Cursor helps you **build** this feature; **billing for end-user scans** is a separate provider account (or Workers AI) with secrets in GitHub / Cloudflare, not Cursor settings.

## Architecture

```
Browser (sheet reader)
  │  JPEG/WebP, max ~400KB after client resize
  │  optional: Turnstile token
  ▼
POST /api/sheet-vision  (Cloudflare Worker / vinext route)
  │  rate limit + daily quota (KV or Rate Limiting rules)
  │  OPENAI_API_KEY or Workers AI binding (secret, never client)
  ▼
Vision model → JSON only (structured output)
  │  validate → ScannedEvent[]
  ▼
Client merges with local OMR or replaces when "Enhanced read" is on
```

**Default:** local `recognizeSheetFromImageData` (free, private, offline-capable).  
**Optional:** user taps **Enhanced read** → one guarded API call.

## Request

`POST /api/sheet-vision`

```json
{
  "image": "<base64 JPEG or WebP, no data: prefix>",
  "mime": "image/jpeg",
  "pages": 1,
  "turnstileToken": "<optional>"
}
```

Limits enforced in the route:

- Body size cap (e.g. 600KB JSON)
- Image dimensions cap after decode (e.g. 1600px longest edge)
- Per-IP requests per hour (KV counter or Cloudflare Rate Limiting)

## Response

Success (`200`):

```json
{
  "ok": true,
  "events": [
    {
      "treble": [{ "note": "E4", "staccato": true }],
      "bass": [{ "note": "C3" }]
    }
  ],
  "pages": 1,
  "source": "vision"
}
```

Failure (`4xx` / `5xx`):

```json
{ "ok": false, "reason": "human-readable message" }
```

Shape matches `SheetRecognitionResult` in `app/lib/sheet-recognition.ts`.

## Secrets (GitHub CD → Cloudflare)

Add in repo **Settings → Secrets** (same as `CLOUDFLARE_API_TOKEN`):

| Secret | Purpose |
|--------|---------|
| `OPENAI_API_KEY` | Calls OpenAI vision (if you choose OpenAI) |
| `SHEET_VISION_DAILY_CAP` | Optional, e.g. `200` scans/day globally |
| `TURNSTILE_SECRET_KEY` | Optional bot gate before vision |

Wire into the Worker via `wrangler secret put` or vinext env mapping in deploy config.

**Do not** put these in the client or in Cursor; only in Cloudflare.

## Cost controls

1. **Client:** downscale before upload (already done for local OMR; reuse for vision).
2. **Server:** reject oversize payloads; fixed model + `max_tokens`; structured JSON schema (no rambling).
3. **Quota:** KV key `vision:YYYY-MM-DD` increment; return `429` when over cap.
4. **Product:** Enhanced read behind a toggle; consider logged-in users later for per-user caps.
5. **Fallback:** on API error, keep local OMR result if any.

## Model choice (examples)

- OpenAI: `gpt-4o-mini` with `response_format: json_schema` — good cost/quality for simple grand staff.
- Anthropic: message with image block + tool/schema.
- Workers AI: `@cf/...` vision model if available on your plan — no OpenAI bill, still metered on CF.

## Implementation files

| File | Role |
|------|------|
| `app/api/sheet-vision/route.ts` | POST handler, limits, provider call |
| `app/lib/sheet-vision-types.ts` | Request/response types |
| `app/lib/sheet-vision-parse.ts` | Validate model JSON → `ScannedEvent[]` |
| `app/lib/sheet-vision-client.ts` | Browser helper (resize + fetch) — wire when UI toggle exists |

## Local dev

Without `OPENAI_API_KEY`, the route returns `503` with `{ "ok": false, "reason": "Vision API not configured" }`.

```bash
OPENAI_API_KEY=sk-... npm run dev
```

Test with a small JPEG base64 payload (see unit tests for parse only).

## Privacy

Tell users: **Enhanced read** sends the sheet image to your server and the configured provider. **Local scan** stays on device.
