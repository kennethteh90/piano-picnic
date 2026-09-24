import assert from "node:assert/strict";
import test from "node:test";
import {
  BASS_STAFF_POSITIONS,
  STAFF_NOTE_AREA_LEFT_PCT,
  STAFF_NOTE_AREA_RIGHT_INSET_PCT,
  STAFF_STEP_PX,
  TREBLE_STAFF_POSITIONS,
  ledgerOffsets,
  sequenceNoteLeftPercent,
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

test("sequence preview spreads notes across the staff lines area", () => {
  const total = 8;
  assert.equal(sequenceNoteLeftPercent(0, total), STAFF_NOTE_AREA_LEFT_PCT);
  assert.equal(sequenceNoteLeftPercent(total - 1, total), 100 - STAFF_NOTE_AREA_RIGHT_INSET_PCT);
  for (let index = 1; index < total; index += 1) {
    assert.ok(
      sequenceNoteLeftPercent(index, total) > sequenceNoteLeftPercent(index - 1, total),
      "each note sits further right than the previous",
    );
  }
  assert.equal(sequenceNoteLeftPercent(0, 1), 54);
});

test("ledger offsets mark only notes beyond the staff edges", () => {
  assert.deepEqual(ledgerOffsets("treble", "C4"), [6]);
  assert.deepEqual(ledgerOffsets("treble", "C#4"), [6]);
  assert.deepEqual(ledgerOffsets("treble", "D4"), []);
  assert.deepEqual(ledgerOffsets("treble", "G4"), []);
  assert.deepEqual(ledgerOffsets("bass", "B2"), []);
  assert.deepEqual(ledgerOffsets("bass", "C4"), [6]);
  assert.deepEqual(ledgerOffsets("bass", "D4"), [14]);
  assert.deepEqual(ledgerOffsets("bass", "E4"), [6, 22]);
});
