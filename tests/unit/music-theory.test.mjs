import assert from "node:assert/strict";
import test from "node:test";
import {
  BASS_KEYS,
  CHALLENGE_CHORDS,
  CHORDS,
  NOTE_ROUNDS,
  TREBLE_KEYS,
  getBlackKeys,
  gradeAnswer,
  noteAccidental,
  noteLetter,
  noteToMidi as theoryMidi,
  prettyNotes,
  sameNotes,
  signatureLetters,
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

test("gradeAnswer distinguishes a short answer from a wrong chord", () => {
  assert.equal(gradeAnswer(["C3"], ["C3", "E3", "G3"]), "incomplete");
  assert.equal(gradeAnswer(["C3", "E3", "A3"], ["C3", "E3", "G3"]), "incorrect");
  assert.equal(gradeAnswer(["G3", "C3", "E3"], ["C3", "E3", "G3"]), "correct");
});

test("noteToMidi ranks accidentals and octaves", () => {
  assert.equal(theoryMidi("C4"), 60);
  assert.equal(theoryMidi("C#4"), 61);
  assert.equal(theoryMidi("Bb3"), theoryMidi("A#3"));
  assert.ok(theoryMidi("B2") < theoryMidi("C3"));
  assert.throws(() => theoryMidi("H4"), /Unparseable/);
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
    assert.ok(family.quality === "major" || family.quality === "minor");
    assert.equal(family.companion.quality, "dominant");
    assert.ok(family.notes.some((note) => noteLetter(note) === family.root));
    assert.ok(family.companion.notes.some((note) => noteLetter(note) === family.companion.root));
    const fifths = { C: "G", G: "D", F: "C", D: "A", A: "E" };
    assert.equal(family.companion.root, fifths[family.root]);
    for (const note of [...family.notes, ...family.companion.notes]) {
      assert.match(note, /^[A-G][#b]?\d$/);
      assert.ok(bassRange.has(note), `${note} in ${family.name} is missing from the bass keyboard`);
    }
  }
  assert.equal(CHALLENGE_CHORDS.length, CHORDS.length * 2);
});

test("every chord tone is already in its key signature", () => {
  assert.deepEqual(signatureLetters({ kind: "sharp", count: 3 }), ["F", "C", "G"]);
  assert.deepEqual(signatureLetters({ kind: "flat", count: 1 }), ["B"]);
  for (const family of CHORDS) {
    for (const chord of [family, family.companion]) {
      for (const note of chord.notes) {
        assert.equal(noteAccidental(note, chord.signature), null, `${chord.name} ${note} should not need a notehead accidental`);
      }
    }
  }
  const e7 = CHORDS.find((chord) => chord.companion.name === "E7").companion;
  assert.deepEqual(e7.signature, { kind: "sharp", count: 3 });
  assert.equal(noteAccidental("D4", { kind: "sharp", count: 4 }), "♮");
});

test("find-a-note rounds stay on the treble keyboard", () => {
  const trebleRange = new Set(TREBLE_KEYS);
  for (const note of NOTE_ROUNDS) {
    assert.ok(trebleRange.has(note), `${note} is missing from the treble keyboard`);
    assert.equal(noteToMidi(note) >= 60, true);
  }
});
