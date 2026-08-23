import assert from "node:assert/strict";
import test from "node:test";
import {
  BASS_KEYS,
  CHALLENGE_CHORDS,
  CHORDS,
  NOTE_ROUNDS,
  TREBLE_KEYS,
  getBlackKeys,
  noteLetter,
  prettyNotes,
  sameNotes,
  shuffledIndices,
} from "../../app/lib/music-theory.ts";
import { noteToMidi } from "../helpers/notes.mjs";

test("shuffledIndices returns a permutation of [0, length)", () => {
  for (const length of [0, 1, 2, 3, 7, 10, 50]) {
    const result = shuffledIndices(length);
    assert.equal(result.length, length);
    assert.deepEqual([...result].sort((a, b) => a - b), Array.from({ length }, (_, index) => index));
  }
});

test("shuffledIndices never deals the avoided index first", () => {
  for (let trial = 0; trial < 200; trial += 1) {
    assert.notEqual(shuffledIndices(10, 3)[0], 3);
  }
});

test("shuffledIndices handles trivial decks", () => {
  assert.deepEqual(shuffledIndices(0), []);
  assert.deepEqual(shuffledIndices(1), [0]);
  // avoidFirst is a no-op when there is nothing to swap with.
  assert.deepEqual(shuffledIndices(1, 0), [0]);
});

test("sameNotes compares chord spellings regardless of order", () => {
  assert.equal(sameNotes(["C3", "E3", "G3"], ["G3", "C3", "E3"]), true);
  assert.equal(sameNotes(["C4"], ["C4"]), true);
  assert.equal(sameNotes(["C3", "E3"], ["E3", "G3"]), false);
  assert.equal(sameNotes(["C3", "E3", "G3"], ["C3", "E3"]), false);
  assert.equal(sameNotes([], []), true);
});

test("noteLetter extracts the natural letter", () => {
  assert.equal(noteLetter("F#3"), "F");
  assert.equal(noteLetter("Bb3"), "B");
  assert.equal(noteLetter("C4"), "C");
});

test("prettyNotes pairs each letter with its solfege and accidental", () => {
  assert.deepEqual(prettyNotes(["C4", "F#3", "Bb3"]), ["C · Do", "F♯ · Fa♯", "B♭ · Ti♭"]);
});

test("black keys sit between the right white keys for both registers", () => {
  for (const register of ["treble", "bass"]) {
    const keys = register === "treble" ? TREBLE_KEYS : BASS_KEYS;
    const blackKeys = getBlackKeys(register);
    for (const [indexText, info] of Object.entries(blackKeys)) {
      const index = Number(indexText);
      // A black key belongs between white key `index` and the next one, so it
      // must never hang off the last white key.
      assert.ok(index >= 0 && index < keys.length - 1, `${register} black key at ${index} out of range`);
      assert.match(info.note, /^[A-G][#b]?\d$/);
      // The black key's octave matches the lower white key it leans on.
      assert.equal(info.note.at(-1), keys[index].at(-1));
    }
  }
});

test("treble black keys are spelled in octave 4 and bass in octave 3", () => {
  assert.deepEqual(
    Object.values(getBlackKeys("treble")).map((info) => info.note),
    ["C#4", "D#4", "F#4", "G#4", "Bb4", "C#5", "D#5"],
  );
  assert.deepEqual(
    Object.values(getBlackKeys("bass")).map((info) => info.note),
    ["C#3", "D#3", "F#3", "G#3", "Bb3", "C#4", "D#4"],
  );
});

test("every chord spelling is well-formed and playable on the bass keyboard", () => {
  const bassRange = new Set([...BASS_KEYS, ...Object.values(getBlackKeys("bass")).map((info) => info.note)]);
  assert.equal(CHORDS.length, 5);
  for (const family of CHORDS) {
    assert.equal(family.notes.length, 3, `${family.name} should have three notes`);
    assert.equal(family.companion.notes.length, 3, `${family.companion.name} should have three notes`);
    assert.notEqual(family.name, family.companion.name);
    for (const note of [...family.notes, ...family.companion.notes]) {
      assert.match(note, /^[A-G][#b]?\d$/);
      assert.ok(bassRange.has(note), `${note} in ${family.name} is missing from the bass keyboard`);
    }
  }
  assert.equal(CHALLENGE_CHORDS.length, CHORDS.length * 2);
});

test("find-a-note rounds stay on the treble keyboard", () => {
  const trebleRange = new Set(TREBLE_KEYS);
  for (const note of NOTE_ROUNDS) {
    assert.ok(trebleRange.has(note), `${note} is missing from the treble keyboard`);
    assert.equal(noteToMidi(note) >= 60, true);
  }
});
