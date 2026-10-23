import type { ScannedEvent, ScannedPitch } from "./sheet-recognition.ts";
import type { SheetVisionRequest } from "./sheet-vision-types.ts";

const NOTE = /^[A-G](?:#|b)?\d$/;
function parsePitch(input: unknown): ScannedPitch | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  if (typeof row.note !== "string" || !NOTE.test(row.note)) return null;
  const pitch: ScannedPitch = { note: row.note };
  if (row.staccato === true) pitch.staccato = true;
  if (row.tiedFromPrevious === true) pitch.tiedFromPrevious = true;
  if (row.tiedToNext === true) pitch.tiedToNext = true;
  if (row.slurredFromPrevious === true) pitch.slurredFromPrevious = true;
  if (row.slurredToNext === true) pitch.slurredToNext = true;
  return pitch;
}

function parseEvent(input: unknown): ScannedEvent | null {
  if (input === null || typeof input !== "object" || Array.isArray(input)) return null;
  const row = input as Record<string, unknown>;
  const treble = Array.isArray(row.treble) ? row.treble.map(parsePitch).filter(Boolean) as ScannedPitch[] : [];
  const bass = Array.isArray(row.bass) ? row.bass.map(parsePitch).filter(Boolean) as ScannedPitch[] : [];
  if (treble.length === 0 && bass.length === 0) return null;
  return { treble, bass };
}

export function parseVisionModelPayload(input: unknown): { ok: true; events: ScannedEvent[] } | { ok: false; error: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "model output must be an object" };
  }
  const body = input as Record<string, unknown>;
  if (!Array.isArray(body.events) || body.events.length === 0) {
    return { ok: false, error: "model output missing events" };
  }
  const events: ScannedEvent[] = [];
  for (const item of body.events) {
    const event = parseEvent(item);
    if (!event) return { ok: false, error: "invalid event in model output" };
    events.push(event);
  }
  return { ok: true, events };
}

export function parseVisionRequestBody(
  input: unknown,
  maxImageBytes: number,
): { ok: true; request: SheetVisionRequest } | { ok: false; error: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = input as Record<string, unknown>;
  if (typeof body.image !== "string" || body.image.length === 0) {
    return { ok: false, error: "image is required" };
  }
  if (body.image.length > maxImageBytes) {
    return { ok: false, error: "image too large" };
  }
  if (!/^[A-Za-z0-9+/=]+$/.test(body.image)) {
    return { ok: false, error: "image must be base64" };
  }
  const mime = body.mime;
  if (mime !== "image/jpeg" && mime !== "image/webp" && mime !== "image/png") {
    return { ok: false, error: "unsupported mime" };
  }
  const request: SheetVisionRequest = { image: body.image, mime };
  if (body.pages !== undefined) {
    if (typeof body.pages !== "number" || body.pages < 1 || body.pages > 20) {
      return { ok: false, error: "invalid pages" };
    }
    request.pages = body.pages;
  }
  if (body.turnstileToken !== undefined) {
    if (typeof body.turnstileToken !== "string" || body.turnstileToken.length > 2048) {
      return { ok: false, error: "invalid turnstile token" };
    }
    request.turnstileToken = body.turnstileToken;
  }
  return { ok: true, request };
}
