# Sheet vision API (LLM)

## Default provider: Google Gemini

Production should use **Gemini with billing enabled** (pay-as-you-go API key), not the no-card free tier, so prompts are handled under Google's **paid API data terms** (not used to improve Google products). Confirm current terms in [Google AI Studio](https://aistudio.google.com/) / Gemini API documentation before launch.

OpenAI remains available as a fallback via `SHEET_VISION_PROVIDER=openai`.

## Architecture

```
Browser (sheet reader)
  │  JPEG/WebP, max ~400KB after client resize
  │  optional: Turnstile token
  ▼
POST /api/sheet-vision  (Cloudflare Worker / vinext route)
  │  rate limit + daily quota (KV — TODO)
  │  GEMINI_API_KEY (secret, never client)
  ▼
Gemini Flash → JSON only
  │  validate → ScannedEvent[]
  ▼
Client uses result when "Enhanced read" is on; else local OMR
```

**Default scan:** enhanced read via `POST /api/sheet-vision` (Gemini). On API errors, the client falls back to local OMR. Users can enable **On-device scan only** in the UI.  
**Rate limit:** 50 requests per IP per hour (KV binding `SHEET_VISION_RATELIMIT`), override with `SHEET_VISION_HOURLY_LIMIT`.

## Request

`POST /api/sheet-vision`

```json
{
  "image": "<base64, no data: prefix>",
  "mime": "image/jpeg",
  "pages": 1,
  "turnstileToken": "<optional>"
}
```

## Response

Same shape as `SheetRecognitionResult` plus `source: "vision"` on success.

## Secrets

| Secret | Purpose |
|--------|---------|
| `GEMINI_API_KEY` | **Required** for enhanced read (from Google AI Studio / Cloud with billing) |
| `GEMINI_MODEL` | Optional, default `gemini-2.0-flash` |
| `SHEET_VISION_PROVIDER` | Optional: `gemini` (default when Gemini key set) or `openai` |
| `OPENAI_API_KEY` | Only if using OpenAI instead |
| `SHEET_VISION_DAILY_CAP` | Optional global daily limit (TODO: KV) |
| `TURNSTILE_SECRET_KEY` | Optional bot gate (TODO) |

### Cloudflare (production)

1. Create a KV namespace for rate limits:
   ```bash
   npx wrangler kv namespace create SHEET_VISION_RATELIMIT
   ```
2. Put the namespace id in `.openai/hosting.json` as `vision_rate_kv_id` (or update the generated wrangler config).
3. Set the Gemini key:
   ```bash
   npx wrangler secret put GEMINI_API_KEY --config dist/server/wrangler.json
   ```

For GitHub Actions, add `GEMINI_API_KEY` as a repository secret and extend CD to pass it into the Worker if your vinext deploy supports env binding (or set once manually in the dashboard).

**Do not** commit keys or put them in Cursor; only in Cloudflare / GitHub secrets.

## Privacy (product copy)

- **Local scan:** image stays on the device.
- **Enhanced read:** image is sent to your server, then to **Google Gemini** under your API project. Use a **billed** API key and link to Google's privacy terms in the UI.

## Local dev

```bash
GEMINI_API_KEY=... npm run dev
```

Without a key, `POST /api/sheet-vision` returns **503**.

## Files

| File | Role |
|------|------|
| `app/api/sheet-vision/route.ts` | POST handler |
| `app/lib/sheet-vision-gemini.ts` | Gemini `generateContent` |
| `app/lib/sheet-vision-provider.ts` | Provider selection |
| `app/lib/sheet-vision-parse.ts` | JSON validation |
| `app/lib/sheet-vision-client.ts` | Browser fetch helper |

## Cost controls

Downscale on client, cap body size, JSON-only output, daily quota (TODO), Turnstile (TODO), keep local OMR as free default.
