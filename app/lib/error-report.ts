export const ERROR_SOURCES = ["window", "unhandledrejection", "boundary"] as const;

export type ErrorSource = (typeof ERROR_SOURCES)[number];

export type ErrorRecord = {
  message: string;
  stack?: string;
  source: ErrorSource;
  path: string;
};

const SOURCES = new Set<string>(ERROR_SOURCES);

export function sanitizeErrorText(text: string, maxLength: number) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .slice(0, maxLength);
}

function isSafePath(path: string) {
  return path.length <= 120 && /^\/[A-Za-z0-9/_.-]*$/.test(path);
}

export function parseErrorPayload(input: unknown): { ok: true; record: ErrorRecord } | { ok: false; error: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = input as Record<string, unknown>;
  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return { ok: false, error: "message is required" };
  }
  if (typeof body.source !== "string" || !SOURCES.has(body.source)) return { ok: false, error: "unknown source" };
  if (typeof body.path !== "string" || !isSafePath(body.path)) return { ok: false, error: "invalid path" };

  const record: ErrorRecord = {
    message: sanitizeErrorText(body.message.trim(), 500),
    source: body.source as ErrorSource,
    path: body.path,
  };
  if (record.message.length === 0) return { ok: false, error: "message is required" };
  if (body.stack !== undefined) {
    if (typeof body.stack !== "string") return { ok: false, error: "stack must be a string" };
    const stack = sanitizeErrorText(body.stack, 2000);
    if (stack.length > 0) record.stack = stack;
  }
  return { ok: true, record };
}
