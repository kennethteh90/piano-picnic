import assert from "node:assert/strict";
import test from "node:test";
import { beatSecondsForTempo, scoreLengthSeconds, scoreSchedule } from "../../app/lib/sheet-playback.ts";

test("score playback spaces chords evenly and honors tempo presets", () => {
  const events = [
    { treble: [{ note: "C4" }], bass: [] },
    { treble: [{ note: "E4" }, { note: "G4" }], bass: [{ note: "C3" }] },
  ];
  const schedule = scoreSchedule(events, 0.5);
  assert.deepEqual(schedule.map((event) => event.notes[0]), ["C4", "E4", "G4", "C3"]);
  assert.deepEqual(schedule.map((event) => event.at), [0, 0.5, 0.5, 0.5]);
  assert.ok(Math.abs(scoreLengthSeconds(events, 0.5) - 0.97) < 0.02);
  assert.equal(beatSecondsForTempo("quick"), 0.36);
});
