import assert from "node:assert/strict";
import test from "node:test";
import { SHORTCUTS, matchShortcut, shortcutApplies, shortcutHelp } from "../../app/lib/shortcuts.ts";

test("the four game shortcuts are hear chord, hear notes, hint, and check", () => {
  assert.deepEqual(SHORTCUTS.map((shortcut) => shortcut.title), ["Hear chord", "Hear notes", "Hint", "Check"]);
  assert.deepEqual(SHORTCUTS.map((shortcut) => shortcut.label), ["C", "N", "H", "Enter"]);
});

test("letter shortcuts ignore case and modifiers", () => {
  assert.equal(matchShortcut({ key: "c" }), "hearChord");
  assert.equal(matchShortcut({ key: "C" }), "hearChord");
  assert.equal(matchShortcut({ key: "n" }), "hearNotes");
  assert.equal(matchShortcut({ key: "H" }), "hint");
  assert.equal(matchShortcut({ key: "Enter" }), "check");
  assert.equal(matchShortcut({ key: "c", metaKey: true }), null);
  assert.equal(matchShortcut({ key: "c", ctrlKey: true }), null);
  assert.equal(matchShortcut({ key: "n", altKey: true }), null);
  assert.equal(matchShortcut({ key: "Enter", repeat: true }), null);
  assert.equal(matchShortcut({ key: "x" }), null);
  assert.equal(matchShortcut({ key: " " }), null);
});

test("Find a note has no hear-notes shortcut, and lessons wait until practice for hint and check", () => {
  assert.equal(shortcutApplies("hearNotes", "note", true), false);
  assert.equal(shortcutApplies("hearChord", "note", true), true);
  assert.equal(shortcutApplies("hint", "learn", false), false);
  assert.equal(shortcutApplies("check", "learn", false), false);
  assert.equal(shortcutApplies("hearChord", "learn", false), true);
  assert.equal(shortcutApplies("hint", "hear", true), true);

  const noteHelp = shortcutHelp("note").map((shortcut) => shortcut.title);
  assert.deepEqual(noteHelp, ["Hear note", "Hint", "Check"]);
  assert.deepEqual(shortcutHelp("hear").map((shortcut) => shortcut.title), ["Hear chord", "Hear notes", "Hint", "Check"]);
});
