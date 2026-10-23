// Hearing identification: name a note, a home chord, or a short journey.
// The module is pure so the decks, playback plan, and hints can be unit-tested.

import { hintBudget, type Difficulty } from "./difficulty.ts";
import { CHORDS, SOLFEGE, type Chord, type ChordFamily, type NoteName } from "./music-theory.ts";

export type NameDeck = "note" | "home" | "journey";

export type JourneyPattern = "home" | "companion-home" | "home-companion-home";

export const EAR_NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"] as const;

export const JOURNEY_PATTERNS: readonly JourneyPattern[] = ["home", "companion-home", "home-companion-home"];

export const NAME_DECKS: readonly NameDeck[] = ["note", "home", "journey"];

const JOURNEY_GAP: Record<Difficulty, number> = {
  seedling: 1.2,
  explorer: 0.62,
  superstar: 0.28,
};

export type NameQuestion = {
  deck: NameDeck;
  answerId: string;
  note: string | null;
  chord: Chord | null;
  pattern: JourneyPattern | null;
  familyIndex: number | null;
};

export type NameChoice = {
  id: string;
  title: string;
  detail: string;
  color: string;
};

export type Sounding = {
  notes: string[];
  at: number;
  duration: number;
};

export function deckLength(deck: NameDeck) {
  if (deck === "note") return EAR_NOTES.length;
  if (deck === "home") return CHORDS.length;
  return CHORDS.length * JOURNEY_PATTERNS.length;
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function nameQuestion(deck: NameDeck, index: number): NameQuestion {
  const safe = wrapIndex(index, deckLength(deck));
  if (deck === "note") {
    const note = EAR_NOTES[safe];
    return { deck, answerId: note, note, chord: null, pattern: null, familyIndex: null };
  }
  if (deck === "home") {
    const chord = CHORDS[safe];
    return { deck, answerId: chord.name, note: null, chord, pattern: null, familyIndex: safe };
  }
  const familyIndex = Math.floor(safe / JOURNEY_PATTERNS.length);
  const pattern = JOURNEY_PATTERNS[safe % JOURNEY_PATTERNS.length];
  return { deck, answerId: pattern, note: null, chord: CHORDS[familyIndex], pattern, familyIndex };
}

function familyAt(question: NameQuestion): ChordFamily {
  return CHORDS[question.familyIndex ?? 0];
}

export function journeyNotes(family: ChordFamily, pattern: JourneyPattern): string[][] {
  if (pattern === "home") return [family.notes];
  if (pattern === "companion-home") return [family.companion.notes, family.notes];
  return [family.notes, family.companion.notes, family.notes];
}

function rootPitch(chord: Chord) {
  return chord.notes.find((note) => note.startsWith(chord.root)) ?? chord.notes[0];
}

export function nameSchedule(difficulty: Difficulty, question: NameQuestion): Sounding[] {
  if (question.deck === "note" && question.note) {
    if (difficulty === "seedling") {
      return [
        { notes: ["C4"], at: 0, duration: 0.85 },
        { notes: [question.note], at: 1.2, duration: 1.5 },
      ];
    }
    return [{ notes: [question.note], at: 0, duration: 1.6 }];
  }

  if (question.deck === "home" && question.chord) {
    if (difficulty === "seedling") {
      return [
        { notes: [rootPitch(question.chord)], at: 0, duration: 0.75 },
        { notes: question.chord.notes, at: 1, duration: 1.8 },
      ];
    }
    return [{ notes: question.chord.notes, at: 0, duration: 1.8 }];
  }

  const steps = journeyNotes(familyAt(question), question.pattern ?? "home");
  const gap = JOURNEY_GAP[difficulty];
  const duration = difficulty === "superstar" ? 0.85 : 1.05;
  return steps.map((notes, index) => ({ notes, at: index * gap, duration }));
}

export function gradeChoice(chosen: string | null, answerId: string) {
  if (!chosen) return "incomplete" as const;
  return chosen === answerId ? "correct" as const : "incorrect" as const;
}

function syllable(letter: NoteName) {
  return SOLFEGE[letter];
}

function noteSyllable(note: string) {
  return syllable(note[0] as NoteName);
}

export function nameChoices(question: NameQuestion, difficulty: Difficulty): NameChoice[] {
  if (question.deck === "note") return [];
  if (question.deck === "home") {
    return CHORDS.map((chord) => ({
      id: chord.name,
      title: difficulty === "superstar" ? syllable(chord.root) : `${chord.root} · ${syllable(chord.root)}`,
      detail: difficulty === "superstar" ? "" : chord.name,
      color: chord.color,
    }));
  }
  const family = familyAt(question);
  return JOURNEY_PATTERNS.map((pattern) => ({
    id: pattern,
    title: journeyTitle(pattern),
    detail: difficulty === "superstar" ? "" : journeyDetail(family, pattern),
    color: family.color,
  }));
}

export function journeyTitle(pattern: JourneyPattern) {
  if (pattern === "home") return "Home";
  if (pattern === "companion-home") return "Companion, then home";
  return "Home, then companion, then home";
}

function journeyDetail(family: ChordFamily, pattern: JourneyPattern) {
  const home = family.name;
  const companion = family.companion.name;
  if (pattern === "home") return home;
  if (pattern === "companion-home") return `${companion} · ${home}`;
  return `${home} · ${companion} · ${home}`;
}

// What a Seedling hears when they tap a home-chord or journey card.
export function choiceSchedule(difficulty: Difficulty, question: NameQuestion, choiceId: string): Sounding[] {
  if (question.deck === "home") {
    const familyIndex = CHORDS.findIndex((chord) => chord.name === choiceId);
    const chord = CHORDS[familyIndex];
    if (!chord) return [];
    return nameSchedule(difficulty, { ...question, answerId: chord.name, chord, familyIndex });
  }
  if (question.deck === "journey" && JOURNEY_PATTERNS.includes(choiceId as JourneyPattern)) {
    return nameSchedule(difficulty, { ...question, answerId: choiceId, pattern: choiceId as JourneyPattern });
  }
  return [];
}

export function nameAnswerLabel(question: NameQuestion) {
  if (question.deck === "note" && question.note) {
    if (question.note === "C4") return "Middle Do";
    if (question.note === "C5") return "High Do";
    return `${question.note[0]} · ${noteSyllable(question.note)}`;
  }
  if (question.deck === "home" && question.chord) return question.chord.name;
  return journeyTitle(question.pattern ?? "home");
}

export function nameInstruction(deck: NameDeck, difficulty: Difficulty) {
  if (deck === "note") {
    if (difficulty === "seedling") return "Middle Do plays first. Then tap the note you heard.";
    if (difficulty === "explorer") return "Listen, then tap the key with its name showing.";
    return "Listen, then tap the key. The names are hidden.";
  }
  if (deck === "home") {
    if (difficulty === "seedling") return "The root plays first. Tap a choice to hear it, or try the piano.";
    if (difficulty === "explorer") return "Listen to the chord, then choose its name.";
    return "Listen, then choose the home syllable.";
  }
  if (difficulty === "seedling") return "The chords sit apart. Tap a choice to hear it, or try the piano.";
  if (difficulty === "explorer") return "The chords move a little faster. Choose the journey.";
  return "You hear one short phrase. The cards say Home and Companion.";
}

export function nameHint(input: { question: NameQuestion; difficulty: Difficulty; hintsUsed: number }) {
  const budget = hintBudget("name", input.difficulty);
  const hintsUsed = Number.isInteger(input.hintsUsed) && input.hintsUsed > 0 ? Math.min(input.hintsUsed, budget) : 0;
  if (hintsUsed === 0) return { message: null as string | null, glowNotes: [] as string[], choiceId: null as string | null, hintsUsed, budget };

  const { question, difficulty } = input;
  if (question.deck === "note" && question.note) {
    const note = question.note;
    if (difficulty === "superstar") {
      const message = note === "C4"
        ? "It is the lower Do."
        : note === "C5"
          ? "It is the upper Do."
          : "It sits between the two Do keys.";
      return { message, glowNotes: [] as string[], choiceId: null, hintsUsed, budget };
    }
    if (note === "C4" || note === "C5") {
      const which = note === "C4" ? "lower" : "upper";
      const message = difficulty === "seedling" ? `Look for the glowing ${which} Do.` : `This is the ${which} Do.`;
      return { message, glowNotes: difficulty === "seedling" ? [note] : [], choiceId: null, hintsUsed, budget };
    }
    const message = difficulty === "seedling"
      ? `Look for the glowing ${noteSyllable(note)} key.`
      : `This note is called ${noteSyllable(note)}.`;
    return { message, glowNotes: difficulty === "seedling" ? [note] : [], choiceId: null, hintsUsed, budget };
  }

  if (question.deck === "home" && question.chord) {
    const homeSyllable = syllable(question.chord.root);
    if (difficulty === "seedling") {
      const color = question.chord.quality === "minor" ? "minor" : "major";
      return {
        message: `This home chord is ${color}. Match its lowest note on the piano.`,
        glowNotes: [] as string[],
        choiceId: null,
        hintsUsed,
        budget,
      };
    }
    return { message: `The home syllable is ${homeSyllable}.`, glowNotes: [] as string[], choiceId: null, hintsUsed, budget };
  }

  const pattern = question.pattern ?? "home";
  const family = familyAt(question);
  if (difficulty === "seedling") {
    return {
      message: `You heard ${journeyDetail(family, pattern)}.`,
      glowNotes: [] as string[],
      choiceId: pattern,
      hintsUsed,
      budget,
    };
  }
  const message = pattern === "home"
    ? "It stays on the home chord."
    : pattern === "companion-home"
      ? "It comes home at the end."
      : "It leaves home and comes back.";
  return { message, glowNotes: [] as string[], choiceId: null, hintsUsed, budget };
}
