import assert from "node:assert/strict";
import test from "node:test";
import { scoreLengthSecondsFromNotes, scoreNoteSchedule } from "../../app/lib/sheet-articulation.ts";

test("staccato notes play shorter than legato notes", () => {
  const events = [
    { treble: [{ note: "C4", staccato: true }], bass: [] },
    { treble: [{ note: "D4" }], bass: [] },
  ];
  const schedule = scoreNoteSchedule(events, 0.5);
  assert.ok(schedule[0].duration < schedule[1].duration);
});

test("tied notes sustain across beats without a second attack", () => {
  const events = [
    { treble: [{ note: "E4", tiedToNext: true }], bass: [] },
    { treble: [{ note: "E4", tiedFromPrevious: true }], bass: [] },
    { treble: [{ note: "F4" }], bass: [] },
  ];
  const schedule = scoreNoteSchedule(events, 0.5);
  assert.deepEqual(schedule.map((entry) => entry.note), ["E4", "F4"]);
  assert.ok(schedule[0].duration > 0.9);
});

test("slurred notes sustain through the slur group", () => {
  const events = [
    { treble: [{ note: "E4", slurredToNext: true }], bass: [] },
    { treble: [{ note: "F4", slurredFromPrevious: true }], bass: [] },
    { treble: [{ note: "G4" }], bass: [] },
  ];
  const schedule = scoreNoteSchedule(events, 0.5);
  assert.deepEqual(schedule.map((entry) => entry.note), ["E4", "F4", "G4"]);
  assert.ok(schedule[0].duration > schedule[2].duration);
});

test("score length follows the longest sounding note", () => {
  const events = [
    { treble: [{ note: "E4", tiedToNext: true }], bass: [] },
    { treble: [{ note: "E4", tiedFromPrevious: true }], bass: [] },
  ];
  const schedule = scoreNoteSchedule(events, 0.5);
  assert.equal(scoreLengthSecondsFromNotes(schedule), schedule[0].at + schedule[0].duration);
});
