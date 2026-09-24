import assert from "node:assert/strict";
import test from "node:test";
import { gradePractice, matchPerformanceToScore } from "../../app/lib/performance-match.ts";
import { scoreFromNoteNames } from "../../app/lib/sheet-score.ts";
import { noteToMidi } from "../../app/lib/note-pitch.ts";

test("matchPerformanceToScore aligns monophonic notes in order", () => {
  const score = scoreFromNoteNames(["C4", "D4", "E4"], "treble", 60);
  const beat = 1;
  const detected = [
    { timeSec: 0.05, midi: noteToMidi("C4") },
    { timeSec: beat + 0.02, midi: noteToMidi("D4") },
    { timeSec: 2 * beat - 0.05, midi: noteToMidi("E4") },
  ];
  const results = matchPerformanceToScore(score, detected);
  assert.equal(results.length, 3);
  assert.ok(results.every((r) => r.ok));
  assert.equal(gradePractice(results), "pass");
});

test("matchPerformanceToScore flags wrong pitch", () => {
  const score = scoreFromNoteNames(["C4", "E4"], "treble", 60);
  const detected = [
    { timeSec: 0, midi: noteToMidi("C4") },
    { timeSec: 1, midi: noteToMidi("F4") },
  ];
  const results = matchPerformanceToScore(score, detected);
  assert.equal(results[0].ok, true);
  assert.equal(results[1].ok, false);
  assert.equal(gradePractice(results), "partial");
});
