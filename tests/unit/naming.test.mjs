import assert from "node:assert/strict";
import test from "node:test";
import { CHORDS } from "../../app/lib/music-theory.ts";
import {
  EAR_NOTES,
  JOURNEY_PATTERNS,
  deckLength,
  choiceSchedule,
  gradeChoice,
  journeyNotes,
  nameAnswerLabel,
  nameChoices,
  nameHint,
  nameQuestion,
  nameSchedule,
} from "../../app/lib/naming.ts";

test("middle Do through high Do is the hearing-note deck", () => {
  assert.deepEqual([...EAR_NOTES], ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]);
  assert.equal(deckLength("note"), 8);
  assert.equal(nameQuestion("note", 0).answerId, "C4");
  assert.equal(nameQuestion("note", 7).answerId, "C5");
  assert.equal(nameQuestion("note", 8).answerId, "C4");
});

test("home questions are the five tonic chords", () => {
  assert.equal(deckLength("home"), CHORDS.length);
  assert.deepEqual(
    Array.from({ length: deckLength("home") }, (_, index) => nameQuestion("home", index).answerId),
    CHORDS.map((chord) => chord.name),
  );
  assert.equal(nameQuestion("home", 0).chord.notes.includes("C3"), true);
});

test("each family is heard as three different journeys", () => {
  assert.equal(deckLength("journey"), CHORDS.length * 3);
  assert.deepEqual(nameQuestion("journey", 0).pattern, "home");
  assert.deepEqual(nameQuestion("journey", 1).pattern, "companion-home");
  assert.deepEqual(nameQuestion("journey", 2).pattern, "home-companion-home");
  assert.equal(nameQuestion("journey", 3).chord.name, CHORDS[1].name);

  const family = CHORDS[0];
  assert.deepEqual(journeyNotes(family, "home"), [family.notes]);
  assert.deepEqual(journeyNotes(family, "companion-home"), [family.companion.notes, family.notes]);
  assert.deepEqual(journeyNotes(family, "home-companion-home"), [family.notes, family.companion.notes, family.notes]);
  assert.deepEqual([...JOURNEY_PATTERNS], ["home", "companion-home", "home-companion-home"]);
});

test("Seedling plays a reference and the other levels start on the question", () => {
  const note = nameQuestion("note", 2);
  const seedling = nameSchedule("seedling", note);
  assert.deepEqual(seedling.map((event) => event.notes), [["C4"], ["E4"]]);
  assert.ok(seedling[1].at > seedling[0].duration);
  assert.deepEqual(nameSchedule("explorer", note), [{ notes: ["E4"], at: 0, duration: 1.6 }]);
  assert.deepEqual(nameSchedule("superstar", note)[0].notes, ["E4"]);

  const home = nameQuestion("home", 1);
  const rooted = nameSchedule("seedling", home);
  assert.deepEqual(rooted[0].notes, ["G3"]);
  assert.deepEqual(rooted[1].notes, home.chord.notes);
  assert.equal(nameSchedule("explorer", home).length, 1);
});

test("journey chords move closer together as the level rises", () => {
  const question = nameQuestion("journey", 2);
  const gaps = ["seedling", "explorer", "superstar"].map((level) => {
    const schedule = nameSchedule(level, question);
    assert.equal(schedule.length, 3);
    return schedule[1].at - schedule[0].at;
  });
  assert.ok(gaps[0] > gaps[1]);
  assert.ok(gaps[1] > gaps[2]);
});

test("tapping a Seedling card previews that choice, not the hidden answer", () => {
  const home = nameQuestion("home", 0);
  const otherHome = choiceSchedule("seedling", home, "G major");
  assert.deepEqual(otherHome[0].notes, ["G3"]);
  assert.deepEqual(otherHome[1].notes, CHORDS[1].notes);

  const journey = nameQuestion("journey", 0);
  const away = choiceSchedule("seedling", journey, "companion-home");
  assert.deepEqual(away.map((event) => event.notes), [CHORDS[0].companion.notes, CHORDS[0].notes]);
  assert.ok(away[1].at > away[0].at);
  assert.deepEqual(choiceSchedule("seedling", home, "not-a-chord"), []);
});

test("a missing choice is incomplete and only the heard answer is correct", () => {
  assert.equal(gradeChoice(null, "E4"), "incomplete");
  assert.equal(gradeChoice("F4", "E4"), "incorrect");
  assert.equal(gradeChoice("E4", "E4"), "correct");
  assert.equal(gradeChoice("home-companion-home", "home"), "incorrect");
});

test("note hints name a syllable for Seedling and only the Do bounds for Superstar", () => {
  const ask = (index, difficulty, hintsUsed = 1) => nameHint({
    question: nameQuestion("note", index),
    difficulty,
    hintsUsed,
  });
  const seedling = ask(2, "seedling");
  assert.match(seedling.message, /glowing Mi/);
  assert.deepEqual(seedling.glowNotes, ["E4"]);

  const lower = ask(0, "superstar");
  const upper = ask(7, "superstar");
  const between = ask(2, "superstar");
  assert.match(lower.message, /lower Do/);
  assert.match(upper.message, /upper Do/);
  assert.match(between.message, /between the two Do keys/);
  assert.doesNotMatch(between.message, /Mi|Re|Fa|Sol|La|Ti|[A-G]\d/);
  assert.deepEqual(between.glowNotes, []);
  assert.equal(ask(2, "seedling", 0).message, null);
});

test("home and journey hints match the level", () => {
  const home = nameHint({ question: nameQuestion("home", 0), difficulty: "seedling", hintsUsed: 1 });
  assert.match(home.message, /major/);
  assert.match(home.message, /lowest note/);
  assert.doesNotMatch(home.message, /Do|C major/);
  assert.equal(home.choiceId, null);
  const minor = nameHint({ question: nameQuestion("home", 3), difficulty: "seedling", hintsUsed: 1 });
  assert.match(minor.message, /minor/);
  assert.equal(minor.choiceId, null);
  const hidden = nameHint({ question: nameQuestion("home", 3), difficulty: "superstar", hintsUsed: 1 });
  assert.equal(hidden.message, "The home syllable is Re.");
  assert.equal(hidden.choiceId, null);

  const journey = nameHint({ question: nameQuestion("journey", 2), difficulty: "superstar", hintsUsed: 1 });
  assert.equal(journey.message, "It leaves home and comes back.");
  const spelled = nameHint({ question: nameQuestion("journey", 2), difficulty: "seedling", hintsUsed: 1 });
  assert.match(spelled.message, /C major · G7 · C major/);
  assert.equal(spelled.choiceId, "home-companion-home");
});

test("choice cards keep letters on Explorer and hide them on Superstar", () => {
  const home = nameQuestion("home", 0);
  assert.equal(nameChoices(home, "explorer")[0].title, "C · Do");
  assert.equal(nameChoices(home, "superstar")[0].title, "Do");
  assert.equal(nameChoices(home, "superstar")[0].detail, "");
  assert.equal(nameChoices(home, "superstar").some((choice) => choice.title.includes("C")), false);

  const journey = nameQuestion("journey", 4);
  const cards = nameChoices(journey, "seedling");
  assert.equal(cards.length, 3);
  assert.match(cards[2].detail, /·/);
  assert.equal(nameChoices(journey, "superstar")[2].detail, "");
  assert.equal(nameAnswerLabel(nameQuestion("note", 0)), "Middle Do");
  assert.equal(nameAnswerLabel(nameQuestion("note", 7)), "High Do");
});
