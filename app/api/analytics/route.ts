import { parseAnalyticsPayload } from "../../lib/analytics";
import { APP_VERSION } from "../../lib/version";

const MAX_BYTES = 4000;

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BYTES) return Response.json({ error: "payload too large" }, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const parsed = parseAnalyticsPayload(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  console.log(JSON.stringify({
    kind: "analytics",
    version: APP_VERSION,
    at: new Date().toISOString(),
    ...parsed.record,
  }));
  return new Response(null, { status: 204 });
}

export function GET() {
  return Response.json({ error: "method not allowed" }, { status: 405, headers: { allow: "POST" } });
}
