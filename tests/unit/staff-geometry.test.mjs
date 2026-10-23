import assert from "node:assert/strict";
import test from "node:test";
import {
  BASS_STAFF_POSITIONS,
  STAFF_STEP_PX,
  TREBLE_STAFF_POSITIONS,
  ledgerCenters,
  signaturePitch,
  staffPositions,
} from "../../app/lib/staff-geometry.ts";
import { BASS_KEYS, TREBLE_KEYS } from "../../app/lib/music-theory.ts";
import { noteToMidi } from "../helpers/notes.mjs";

test("every white key on both keyboards has a staff position", () => {
  for (const [keys, positions] of [
    [TREBLE_KEYS, TREBLE_STAFF_POSITIONS],
    [BASS_KEYS, BASS_STAFF_POSITIONS],
  ]) {
    for (const key of keys) {
      assert.ok(key in positions, `no staff position for ${key}`);
    }
  }
});

test("noteheads rise monotonically with pitch", () => {
  // Accidentals intentionally share a slot with their neighbouring natural,
  // so equal pitches at equal heights are allowed — but pitch never descends.
  for (const positions of [TREBLE_STAFF_POSITIONS, BASS_STAFF_POSITIONS]) {
    const entries = Object.entries(positions)
      .map(([note, position]) => ({ note, position, midi: noteToMidi(note) }))
      .sort((a, b) => a.midi - b.midi);
    for (let index = 1; index < entries.length; index += 1) {
      assert.ok(
        entries[index].position >= entries[index - 1].position,
        `${entries[index].note} must not sit below ${entries[index - 1].note}`,
      );
    }
  }
});

test("each diatonic step is exactly one staff step apart", () => {
  // Adjacent letters in the spelling of each map must move by one step; an
  // octave is always seven diatonic steps.
  const diatonicSteps = (positions) => {
    const sorted = Object.keys(positions)
      .filter((note) => !/[#b]/.test(note))
      .sort((a, b) => noteToMidi(a) - noteToMidi(b));
    return sorted.map((note) => positions[note]);
  };

  for (const positions of [TREBLE_STAFF_POSITIONS, BASS_STAFF_POSITIONS]) {
    const steps = diatonicSteps(positions);
    for (let index = 1; index < steps.length; index += 1) {
      assert.equal(
        steps[index] - steps[index - 1],
        STAFF_STEP_PX,
        `gap between natural notes ${index - 1} and ${index} is not one staff step`,
      );
    }
  }
});

test("one octave spans seven diatonic steps on the staff", () => {
  assert.equal(TREBLE_STAFF_POSITIONS.C5 - TREBLE_STAFF_POSITIONS.C4, 7 * STAFF_STEP_PX);
  assert.equal(BASS_STAFF_POSITIONS.C4 - BASS_STAFF_POSITIONS.C3, 7 * STAFF_STEP_PX);
});

test("accidentals share their slot with a neighbouring natural", () => {
  assert.equal(TREBLE_STAFF_POSITIONS["C#4"], TREBLE_STAFF_POSITIONS.C4);
  assert.equal(BASS_STAFF_POSITIONS["Bb3"], BASS_STAFF_POSITIONS.B3);
  assert.equal(staffPositions("bass")["F#3"], BASS_STAFF_POSITIONS.F3);
});

test("ledger lines are shared, horizontal, and only exist outside the staff", () => {
  assert.deepEqual(ledgerCenters("treble", ["C4"]), [54]);
  assert.deepEqual(ledgerCenters("treble", ["C#4"]), [54]);
  assert.deepEqual(ledgerCenters("treble", ["D4"]), []);
  assert.deepEqual(ledgerCenters("treble", ["G4"]), []);
  assert.deepEqual(ledgerCenters("bass", ["B2"]), []);
  assert.deepEqual(ledgerCenters("bass", ["C4"]), [150]);
  assert.deepEqual(ledgerCenters("bass", ["D4"]), [150]);
  assert.deepEqual(ledgerCenters("bass", ["E4"]), [150, 166]);
  // E7 stacks D and E above the staff. One line per staff position, not one stub per note.
  assert.deepEqual(ledgerCenters("bass", ["G#3", "D4", "E4"]), [150, 166]);
});

test("signature accidentals use the octave beside the clef", () => {
  assert.equal(signaturePitch("bass", "G", "sharp"), "G3");
  assert.equal(signaturePitch("bass", "F", "sharp"), "F3");
  assert.equal(signaturePitch("bass", "B", "flat"), "B2");
  assert.equal(signaturePitch("treble", "F", "sharp"), "F5");
});
