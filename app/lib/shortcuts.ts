import type { GameMode } from "./difficulty.ts";

export type ShortcutId = "hearChord" | "hearNotes" | "hint" | "check";

export type Shortcut = {
  id: ShortcutId;
  key: string;
  label: string;
  title: string;
};

export const SHORTCUTS: readonly Shortcut[] = [
  { id: "hearChord", key: "c", label: "C", title: "Hear chord" },
  { id: "hearNotes", key: "n", label: "N", title: "Hear notes" },
  { id: "hint", key: "h", label: "H", title: "Hint" },
  { id: "check", key: "Enter", label: "Enter", title: "Check" },
];

const BY_KEY = new Map<string, ShortcutId>([
  ["c", "hearChord"],
  ["n", "hearNotes"],
  ["h", "hint"],
  ["enter", "check"],
]);

export function matchShortcut(event: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; repeat?: boolean }) {
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return null;
  return BY_KEY.get(event.key.toLowerCase()) ?? null;
}

export function shortcutApplies(id: ShortcutId, mode: GameMode, practicing: boolean) {
  if (id === "hearNotes" && mode === "note") return false;
  if ((id === "hint" || id === "check") && !practicing) return false;
  return true;
}

export function shortcutHelp(mode: GameMode) {
  return SHORTCUTS
    .filter((shortcut) => shortcutApplies(shortcut.id, mode, true))
    .map((shortcut) => ({ ...shortcut, title: shortcut.id === "hearChord" && mode === "note" ? "Hear note" : shortcut.title }));
}
