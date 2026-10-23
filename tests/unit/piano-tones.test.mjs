import assert from "node:assert/strict";
import test from "node:test";
import { GRAND_VELOCITY_RANGE, PIANO_TONES, gameMidiNotes } from "../../app/lib/piano-tones.ts";

test("the grand piano loads every note the keyboards can play", () => {
  const notes = gameMidiNotes();
  assert.ok(notes.includes(47), "B2");
  assert.ok(notes.includes(76), "E5");
  assert.deepEqual(GRAND_VELOCITY_RANGE, [68, 84]);
  assert.deepEqual(PIANO_TONES.map((tone) => tone.id), ["upright", "grand", "organ"]);
});
