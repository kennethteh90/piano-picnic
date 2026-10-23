import type { Difficulty, GameMode } from "./difficulty.ts";
import type { ShortcutId } from "./shortcuts.ts";

export const ANALYTICS_EVENTS = [
  "page_view",
  "mode_change",
  "difficulty_change",
  "hint_used",
  "answer_checked",
  "shortcut_used",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsRecord = {
  event: AnalyticsEventName;
  mode?: GameMode;
  difficulty?: Difficulty;
  correct?: boolean;
  shortcut?: ShortcutId;
  path?: string;
};

const EVENTS = new Set<string>(ANALYTICS_EVENTS);
const MODES = new Set<string>(["learn", "note", "see", "hear", "name"]);
const LEVELS = new Set<string>(["seedling", "explorer", "superstar"]);
const SHORTCUTS = new Set<string>(["hearChord", "hearNotes", "hint", "check"]);

function isSafePath(path: string) {
  return path.length <= 120 && /^\/[A-Za-z0-9/_.-]*$/.test(path);
}

export function parseAnalyticsPayload(input: unknown): { ok: true; record: AnalyticsRecord } | { ok: false; error: string } {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, error: "payload must be an object" };
  }
  const body = input as Record<string, unknown>;
  if (typeof body.event !== "string" || !EVENTS.has(body.event)) return { ok: false, error: "unknown event" };

  const record: AnalyticsRecord = { event: body.event as AnalyticsEventName };

  if (body.mode !== undefined) {
    if (typeof body.mode !== "string" || !MODES.has(body.mode)) return { ok: false, error: "unknown mode" };
    record.mode = body.mode as GameMode;
  }
  if (body.difficulty !== undefined) {
    if (typeof body.difficulty !== "string" || !LEVELS.has(body.difficulty)) return { ok: false, error: "unknown difficulty" };
    record.difficulty = body.difficulty as Difficulty;
  }
  if (body.correct !== undefined) {
    if (typeof body.correct !== "boolean") return { ok: false, error: "correct must be boolean" };
    record.correct = body.correct;
  }
  if (body.shortcut !== undefined) {
    if (typeof body.shortcut !== "string" || !SHORTCUTS.has(body.shortcut)) return { ok: false, error: "unknown shortcut" };
    record.shortcut = body.shortcut as ShortcutId;
  }
  if (body.path !== undefined) {
    if (typeof body.path !== "string" || !isSafePath(body.path)) return { ok: false, error: "invalid path" };
    record.path = body.path;
  }

  return { ok: true, record };
}
