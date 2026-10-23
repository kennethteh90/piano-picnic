import assert from "node:assert/strict";
import test from "node:test";
import { beatSecondsForTempo, scoreLengthSeconds, scoreSchedule } from "../../app/lib/sheet-playback.ts";

test("score playback spaces chords evenly and honors tempo presets", () => {
  const events = [
    { treble: ["C4"], bass: [] },
    { treble: ["E4", "G4"], bass: ["C3"] },
  ];
  const schedule = scoreSchedule(events, 0.5);
  assert.deepEqual(schedule.map((event) => event.notes), [["C4"], ["E4", "G4", "C3"]]);
  assert.deepEqual(schedule.map((event) => event.at), [0, 0.5]);
  assert.equal(scoreLengthSeconds(events.length, 0.5), 0.96);
  assert.equal(beatSecondsForTempo("quick"), 0.36);
});
