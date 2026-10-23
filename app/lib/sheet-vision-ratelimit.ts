export const SHEET_VISION_HOURLY_LIMIT_DEFAULT = 50;

export function clientIpFromRequest(request: Request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return "unknown";
}

export function hourBucket(now = Date.now()) {
  return Math.floor(now / 3_600_000);
}

export function rateLimitKey(ip: string, bucket: number) {
  return `vision:${ip}:${bucket}`;
}

export function hourlyLimitFromEnv() {
  const raw = process.env.SHEET_VISION_HOURLY_LIMIT?.trim();
  if (!raw) return SHEET_VISION_HOURLY_LIMIT_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return SHEET_VISION_HOURLY_LIMIT_DEFAULT;
  return parsed;
}

export async function consumeSheetVisionRateLimit(
  kv: KVNamespace,
  request: Request,
  limit = hourlyLimitFromEnv(),
): Promise<{ ok: true; remaining: number } | { ok: false; retryAfterSeconds: number }> {
  const ip = clientIpFromRequest(request);
  const bucket = hourBucket();
  const key = rateLimitKey(ip, bucket);
  const raw = await kv.get(key);
  const count = raw ? Number.parseInt(raw, 10) : 0;
  if (count >= limit) {
    const secondsIntoHour = Math.floor((Date.now() % 3_600_000) / 1000);
    return { ok: false, retryAfterSeconds: 3_600 - secondsIntoHour };
  }
  await kv.put(key, String(count + 1), { expirationTtl: 7_200 });
  return { ok: true, remaining: limit - count - 1 };
}
