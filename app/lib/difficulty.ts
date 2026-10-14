import { shuffledIndices } from "./music-theory.ts";

export type Difficulty = "seedling" | "explorer" | "superstar";
export type GameMode = "learn" | "note" | "see" | "hear";

export type DifficultyRules = {
  id: Difficulty;
  label: string;
  mark: string;
  summary: string;
  order: "fixed" | "shuffled";
  reshuffleOnPass: boolean;
  showQuestionNames: boolean;
  showPianoLabels: boolean;
  hintBudget: Record<GameMode, number>;
};

export const DIFFICULTY_RULES: Record<Difficulty, DifficultyRules> = {
  seedling: {
    id: "seedling",
    label: "Seedling",
    mark: "●",
    summary: "Names stay on the screen, questions stay in order, and hints can show the answer.",
    order: "fixed",
    reshuffleOnPass: false,
    showQuestionNames: true,
    showPianoLabels: true,
    hintBudget: { learn: 3, note: 1, see: 3, hear: 3 },
  },
  explorer: {
    id: "explorer",
    label: "Explorer",
    mark: "◆",
    summary: "Names hide, the deck is shuffled once, and hints name one missing note.",
    order: "shuffled",
    reshuffleOnPass: false,
    showQuestionNames: false,
    showPianoLabels: true,
    hintBudget: { learn: 2, note: 2, see: 2, hear: 2 },
  },
  superstar: {
    id: "superstar",
    label: "Superstar",
    mark: "★",
    summary: "The keys go blank, every pass is a new shuffle, and one hint gives a clue without naming a key.",
    order: "shuffled",
    reshuffleOnPass: true,
    showQuestionNames: false,
    showPianoLabels: false,
    hintBudget: { learn: 1, note: 1, see: 1, hear: 1 },
  },
};

export const DIFFICULTIES: Difficulty[] = ["seedling", "explorer", "superstar"];

export function difficultySummary(difficulty: Difficulty, mode: GameMode) {
  const summary = DIFFICULTY_RULES[difficulty].summary;
  if (mode === "learn") return `${summary} The lesson still introduces each key family in order.`;
  return summary;
}

export function showsQuestionNames(difficulty: Difficulty, mode: GameMode, practicing: boolean) {
  if (mode === "learn" && !practicing) return true;
  return DIFFICULTY_RULES[difficulty].showQuestionNames;
}

export function showsPianoLabels(difficulty: Difficulty) {
  return DIFFICULTY_RULES[difficulty].showPianoLabels;
}

export function hintBudget(mode: GameMode, difficulty: Difficulty) {
  return DIFFICULTY_RULES[difficulty].hintBudget[mode];
}

export function questionIndex(difficulty: Difficulty, round: number, order: readonly number[], length: number) {
  if (length <= 0) return 0;
  if (DIFFICULTY_RULES[difficulty].order === "fixed") return round % length;
  return order[round % length] ?? 0;
}

export function afterCorrectRound(
  input: { difficulty: Difficulty; round: number; length: number; order: number[] },
  shuffle: (length: number, avoidFirst?: number) => number[] = shuffledIndices,
) {
  const rules = DIFFICULTY_RULES[input.difficulty];
  if (rules.order === "fixed" || input.length <= 0) {
    return { round: input.round + 1, order: input.order };
  }
  const next = input.round + 1;
  if (next % input.length !== 0) return { round: next, order: input.order };
  if (!rules.reshuffleOnPass) return { round: 0, order: input.order };
  const lastDealt = input.order[input.round % input.length];
  return { round: 0, order: shuffle(input.length, lastDealt) };
}
