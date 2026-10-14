import assert from "node:assert/strict";
import test from "node:test";
import {
  DIFFICULTIES,
  DIFFICULTY_RULES,
  afterCorrectRound,
  difficultySummary,
  hintBudget,
  questionIndex,
  showsPianoLabels,
  showsQuestionNames,
} from "../../app/lib/difficulty.ts";

test("difficulty levels differ on order, labels, or hint strength", () => {
  assert.deepEqual(DIFFICULTIES, ["seedling", "explorer", "superstar"]);
  const levels = DIFFICULTIES.map((id) => DIFFICULTY_RULES[id]);
  const summaries = new Set(levels.map((level) => level.summary));
  assert.equal(summaries.size, levels.length);

  for (let left = 0; left < levels.length; left += 1) {
    for (let right = left + 1; right < levels.length; right += 1) {
      const a = levels[left];
      const b = levels[right];
      const distinct = a.order !== b.order
        || a.reshuffleOnPass !== b.reshuffleOnPass
        || a.showQuestionNames !== b.showQuestionNames
        || a.showPianoLabels !== b.showPianoLabels
        || JSON.stringify(a.hintBudget) !== JSON.stringify(b.hintBudget);
      assert.equal(distinct, true, `${a.id} and ${b.id} should not play the same`);
    }
  }
});

test("only Superstar hides piano labels and reshuffles every pass", () => {
  assert.equal(showsPianoLabels("seedling"), true);
  assert.equal(showsPianoLabels("explorer"), true);
  assert.equal(showsPianoLabels("superstar"), false);
  assert.equal(DIFFICULTY_RULES.seedling.reshuffleOnPass, false);
  assert.equal(DIFFICULTY_RULES.explorer.reshuffleOnPass, false);
  assert.equal(DIFFICULTY_RULES.superstar.reshuffleOnPass, true);
});

test("question names stay on during a lesson and follow the level while practicing", () => {
  for (const difficulty of DIFFICULTIES) {
    assert.equal(showsQuestionNames(difficulty, "learn", false), true);
  }
  assert.equal(showsQuestionNames("seedling", "hear", true), true);
  assert.equal(showsQuestionNames("explorer", "see", true), false);
  assert.equal(showsQuestionNames("superstar", "note", true), false);
  assert.equal(showsQuestionNames("explorer", "learn", true), false);
});

test("hint budgets match what each level is willing to give away", () => {
  assert.deepEqual(DIFFICULTY_RULES.seedling.hintBudget, { learn: 3, note: 1, see: 3, hear: 3 });
  assert.deepEqual(DIFFICULTY_RULES.explorer.hintBudget, { learn: 2, note: 2, see: 2, hear: 2 });
  assert.deepEqual(DIFFICULTY_RULES.superstar.hintBudget, { learn: 1, note: 1, see: 1, hear: 1 });
  for (const mode of ["learn", "see", "hear"]) {
    assert.ok(hintBudget(mode, "seedling") > hintBudget(mode, "explorer"));
    assert.ok(hintBudget(mode, "explorer") > hintBudget(mode, "superstar"));
  }
});

test("Seedling deals a fixed sequence and Explorer repeats one shuffle", () => {
  assert.equal(questionIndex("seedling", 0, [3, 2, 1, 0], 4), 0);
  assert.equal(questionIndex("seedling", 4, [3, 2, 1, 0], 4), 0);
  assert.equal(questionIndex("explorer", 1, [3, 2, 1, 0], 4), 2);

  const explorer = afterCorrectRound({ difficulty: "explorer", round: 3, length: 4, order: [3, 2, 1, 0] });
  assert.deepEqual(explorer, { round: 0, order: [3, 2, 1, 0] });

  const seedling = afterCorrectRound({ difficulty: "seedling", round: 6, length: 7, order: [0, 1, 2, 3, 4, 5, 6] });
  assert.equal(seedling.round, 7);
  assert.deepEqual(seedling.order, [0, 1, 2, 3, 4, 5, 6]);
});

test("Superstar reshuffles after a full pass and passes along the last question", () => {
  let avoided;
  const next = afterCorrectRound({
    difficulty: "superstar",
    round: 2,
    length: 3,
    order: [2, 0, 1],
  }, (length, avoidFirst) => {
    avoided = avoidFirst;
    assert.equal(length, 3);
    return [0, 2, 1];
  });
  assert.equal(avoided, 1);
  assert.deepEqual(next, { round: 0, order: [0, 2, 1] });
  assert.notEqual(questionIndex("superstar", 0, next.order, 3), 1);
});

test("mid-deck answers advance without reshuffling", () => {
  const next = afterCorrectRound({ difficulty: "superstar", round: 0, length: 5, order: [4, 3, 2, 1, 0] }, () => {
    throw new Error("shuffle should wait until the pass ends");
  });
  assert.deepEqual(next, { round: 1, order: [4, 3, 2, 1, 0] });
});

test("Learn adds a sentence that the lesson order stays fixed", () => {
  const lesson = difficultySummary("explorer", "learn");
  const quiz = difficultySummary("explorer", "hear");
  assert.match(lesson, /introduces each key family in order/);
  assert.equal(lesson.startsWith(quiz), true);
  assert.notEqual(lesson, quiz);
});

test("empty decks do not crash the dealer", () => {
  assert.equal(questionIndex("explorer", 3, [], 0), 0);
  assert.deepEqual(afterCorrectRound({ difficulty: "superstar", round: 1, length: 0, order: [] }), { round: 2, order: [] });
});
