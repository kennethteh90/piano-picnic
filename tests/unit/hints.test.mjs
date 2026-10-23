import assert from "node:assert/strict";
import test from "node:test";
import { CHALLENGE_CHORDS, NOTE_ROUNDS, notesByPitch } from "../../app/lib/music-theory.ts";
import { hintView } from "../../app/lib/hints.ts";

const LETTER = /(^|[^A-Za-z])[A-G]([^A-Za-z]|$)/;

function view(overrides) {
  return hintView({
    mode: "see",
    difficulty: "seedling",
    answer: ["C3", "E3", "G3"],
    selected: [],
    hintsUsed: 1,
    chord: { quality: "major", root: "C" },
    ...overrides,
  });
}

test("no hint is showing before the player asks", () => {
  const hint = view({ hintsUsed: 0 });
  assert.equal(hint.message, null);
  assert.deepEqual(hint.staffNotes, []);
  assert.deepEqual(hint.glowNotes, []);
});

test("Seedling Find a note glows the answer, Explorer names it, and Superstar only describes the staff", () => {
  const answer = ["E4"];
  const seedling = view({ mode: "note", difficulty: "seedling", answer, hintsUsed: 1 });
  assert.match(seedling.message, /glowing E · Mi/);
  assert.deepEqual(seedling.glowNotes, ["E4"]);

  const explorerFirst = view({ mode: "note", difficulty: "explorer", answer, hintsUsed: 1 });
  assert.equal(explorerFirst.message, "This note is called E.");
  assert.deepEqual(explorerFirst.glowNotes, []);
  const explorerSecond = view({ mode: "note", difficulty: "explorer", answer, hintsUsed: 2 });
  assert.match(explorerSecond.message, /Find E · Mi/);
  assert.deepEqual(explorerSecond.glowNotes, ["E4"]);

  const superstar = view({ mode: "note", difficulty: "superstar", answer, hintsUsed: 4 });
  assert.equal(superstar.hintsUsed, 1);
  assert.equal(superstar.message, "The notehead is on the bottom line.");
  assert.equal(LETTER.test(superstar.message), false);
  assert.equal(/Do|Re|Mi|Fa|Sol|La|Ti/.test(superstar.message), false);
  assert.deepEqual(superstar.glowNotes, []);
});

test("See a chord hints get less direct as the level rises", () => {
  const answer = ["F#3", "C4", "D4"];
  const chord = { quality: "dominant", root: "D" };

  const seedling = view({ difficulty: "seedling", answer, selected: ["C4"], hintsUsed: 1, chord });
  assert.equal(seedling.message, "Add F♯ · Fa♯ next.");
  assert.deepEqual(seedling.glowNotes, ["F#3"]);

  const seedlingDone = view({ difficulty: "seedling", answer, selected: ["F#3", "C4", "D4"], hintsUsed: 1, chord });
  assert.match(seedlingDone.message, /Clear a note/);

  const explorer = view({ difficulty: "explorer", answer, hintsUsed: 2, chord });
  assert.equal(explorer.message, "The highest note is D.");
  assert.deepEqual(explorer.glowNotes, []);
  assert.deepEqual(explorer.staffNotes, []);

  const superstar = view({ difficulty: "superstar", answer, hintsUsed: 1, chord });
  assert.equal(superstar.message, "This is a dominant chord. Its home syllable is Re.");
  assert.equal(LETTER.test(superstar.message), false);
  assert.equal(superstar.message.includes("D7"), false);
  assert.deepEqual(superstar.glowNotes, []);
});

test("Hear a chord starts differently at each level", () => {
  const answer = ["C3", "E3", "G3"];
  const chord = { quality: "major", root: "C" };
  const seedling = view({ mode: "hear", difficulty: "seedling", answer, hintsUsed: 0, chord });
  const explorer = view({ mode: "hear", difficulty: "explorer", answer, hintsUsed: 0, chord });
  const superstar = view({ mode: "hear", difficulty: "superstar", answer, hintsUsed: 0, chord });

  assert.deepEqual(seedling.staffNotes, ["C3"]);
  assert.deepEqual(seedling.glowNotes, ["C3"]);
  assert.equal(seedling.message, "The lowest note is C · Do.");
  assert.deepEqual(explorer.staffNotes, []);
  assert.equal(explorer.message, null);
  assert.deepEqual(explorer.glowNotes, []);
  assert.deepEqual(superstar.staffNotes, []);
  assert.equal(superstar.message, null);
  assert.deepEqual(superstar.glowNotes, []);
});

test("Hear a chord reveals noteheads only when the level allows it", () => {
  const answer = ["B2", "F3", "G3"];
  const ordered = notesByPitch(answer);
  const chord = { quality: "dominant", root: "G" };

  const seedling = view({ mode: "hear", difficulty: "seedling", answer, hintsUsed: 2, chord });
  assert.deepEqual(seedling.staffNotes, ordered);
  assert.match(seedling.message, /highest note is G · Sol/);
  assert.deepEqual(seedling.glowNotes, ["G3"]);

  const explorer = view({ mode: "hear", difficulty: "explorer", answer, hintsUsed: 2, chord });
  assert.deepEqual(explorer.staffNotes, ordered.slice(0, 2));
  assert.equal(explorer.message, "Two notes are on the staff. The last one is for your ear.");
  assert.equal(LETTER.test(explorer.message), false);
  assert.deepEqual(explorer.glowNotes, []);

  const superstar = view({ mode: "hear", difficulty: "superstar", answer, hintsUsed: 1, chord });
  assert.deepEqual(superstar.staffNotes, []);
  assert.equal(superstar.message, "This is a dominant chord.");
  assert.equal(superstar.message.includes("Sol"), false);
});

test("Learn practice uses the same building hints as See a chord", () => {
  const input = { difficulty: "explorer", answer: ["A3", "C4", "E4"], selected: [], hintsUsed: 1, chord: { quality: "minor", root: "A" } };
  assert.deepEqual(view({ mode: "learn", ...input }), view({ mode: "see", ...input }));
});

test("every challenge chord keeps Superstar hints free of note names", () => {
  for (const chord of CHALLENGE_CHORDS) {
    for (const mode of ["see", "hear", "learn"]) {
      const hint = view({
        mode,
        difficulty: "superstar",
        answer: chord.notes,
        hintsUsed: 1,
        chord: { quality: chord.quality, root: chord.root },
      });
      assert.equal(LETTER.test(hint.message), false, `${mode} ${chord.name}: ${hint.message}`);
      assert.equal(hint.message.includes(chord.name), false);
      assert.deepEqual(hint.glowNotes, []);
      assert.deepEqual(hint.staffNotes, []);
    }
  }
});

test("Superstar Find a note points at the staff and never names the pitch", () => {
  const places = {
    C4: "The notehead is on the little line below the staff.",
    D4: "The notehead is in the space just under the staff.",
    E4: "The notehead is on the bottom line.",
    F4: "The notehead is in the bottom space.",
    G4: "The notehead is on the second line.",
    A4: "The notehead is in the second space.",
    B4: "The notehead is on the middle line.",
  };
  for (const [note, message] of Object.entries(places)) {
    const hint = view({ mode: "note", difficulty: "superstar", answer: [note], hintsUsed: 1 });
    assert.equal(hint.message, message);
    assert.equal(/Do|Re|Mi|Fa|Sol|La|Ti/.test(hint.message), false);
    assert.equal(LETTER.test(hint.message), false);
  }
});

test("Find a note covers every treble round at each level", () => {
  for (const note of NOTE_ROUNDS) {
    for (const difficulty of ["seedling", "explorer", "superstar"]) {
      const hint = view({ mode: "note", difficulty, answer: [note], hintsUsed: 1 });
      assert.equal(typeof hint.message, "string");
      assert.ok(hint.message.length > 0);
    }
  }
});

test("hint state ignores empty answers and negative counts", () => {
  const empty = view({ answer: [], hintsUsed: 2 });
  assert.equal(typeof empty.message, "string");
  assert.deepEqual(empty.glowNotes, []);
  const negative = view({ hintsUsed: -3 });
  assert.equal(negative.hintsUsed, 0);
  assert.equal(negative.message, null);
});
