import { hintBudget, type Difficulty, type GameMode } from "./difficulty.ts";
import {
  SOLFEGE,
  notesByPitch,
  prettyNotes,
  type ChordQuality,
  type NoteName,
} from "./music-theory.ts";

export type HintChord = {
  quality: ChordQuality;
  root: NoteName;
};

export type HintView = {
  message: string | null;
  staffNotes: string[];
  glowNotes: string[];
  hintsUsed: number;
  budget: number;
};

const EMPTY_CHORD: HintChord = { quality: "major", root: "C" };

function letterName(note: string) {
  return prettyNotes([note])[0].split(" · ")[0];
}

function fullName(note: string) {
  return prettyNotes([note])[0];
}

function qualityWord(quality: ChordQuality) {
  if (quality === "major") return "major";
  if (quality === "minor") return "minor";
  return "dominant";
}

function clampUsed(hintsUsed: number, budget: number) {
  if (!Number.isInteger(hintsUsed) || hintsUsed < 0) return 0;
  return Math.min(hintsUsed, budget);
}

function nudge(chord: HintChord): HintView["message"] {
  return `This is a ${qualityWord(chord.quality)} chord. Its home syllable is ${SOLFEGE[chord.root]}.`;
}

function seeStep(difficulty: Difficulty, answer: string[], selected: string[], index: number, chord: HintChord) {
  const ordered = notesByPitch(answer);
  const lowest = ordered[0];
  if (!lowest) return { message: "Listen and try the piano keys.", staffNotes: [] as string[], glowNotes: [] as string[] };

  if (difficulty === "superstar") {
    return { message: nudge(chord), staffNotes: [] as string[], glowNotes: [] as string[] };
  }

  if (difficulty === "explorer") {
    const note = index === 0 ? ordered[0] : ordered[ordered.length - 1];
    const place = index === 0 ? "lowest" : "highest";
    return {
      message: `The ${place} note is ${letterName(note)}.`,
      staffNotes: [] as string[],
      glowNotes: [] as string[],
    };
  }

  const missing = notesByPitch(answer.filter((note) => !selected.includes(note)));
  if (missing.length === 0) {
    return {
      message: `Clear a note that is not in the chord. The lowest note is ${fullName(lowest)}.`,
      staffNotes: [] as string[],
      glowNotes: [lowest],
    };
  }
  const target = missing[Math.min(index, missing.length - 1)];
  return { message: `Add ${fullName(target)} next.`, staffNotes: [] as string[], glowNotes: [target] };
}

function staffPlace(note: string) {
  const places: Record<string, string> = {
    C4: "on the little line below the staff",
    D4: "in the space just under the staff",
    E4: "on the bottom line",
    F4: "in the bottom space",
    G4: "on the second line",
    A4: "in the second space",
    B4: "on the middle line",
  };
  return places[note.replace(/[#b]/, "")] ?? "on the staff";
}

function noteStep(difficulty: Difficulty, answer: string[], index: number) {
  const note = answer[0];
  if (!note) return { message: "Look at the staff, then tap a key.", staffNotes: [] as string[], glowNotes: [] as string[] };

  if (difficulty === "superstar") {
    return { message: `The notehead is ${staffPlace(note)}.`, staffNotes: [] as string[], glowNotes: [] as string[] };
  }
  if (difficulty === "explorer") {
    if (index === 0) {
      return { message: `This note is called ${letterName(note)}.`, staffNotes: [] as string[], glowNotes: [] as string[] };
    }
    return { message: `Find ${fullName(note)} on the piano.`, staffNotes: [] as string[], glowNotes: [note] };
  }
  return { message: `Look for the glowing ${fullName(note)} key.`, staffNotes: [] as string[], glowNotes: [note] };
}

function hearOpening(difficulty: Difficulty, answer: string[]) {
  if (difficulty !== "seedling") return { message: null as string | null, staffNotes: [] as string[], glowNotes: [] as string[] };
  const lowest = notesByPitch(answer)[0];
  if (!lowest) return { message: null, staffNotes: [], glowNotes: [] };
  return {
    message: `The lowest note is ${fullName(lowest)}.`,
    staffNotes: [lowest],
    glowNotes: [lowest],
  };
}

function hearStep(difficulty: Difficulty, answer: string[], index: number, chord: HintChord) {
  const ordered = notesByPitch(answer);
  if (ordered.length === 0) return { message: "Press play and listen again.", staffNotes: [] as string[], glowNotes: [] as string[] };

  if (difficulty === "superstar") {
    return { message: `This is a ${qualityWord(chord.quality)} chord.`, staffNotes: [] as string[], glowNotes: [] as string[] };
  }

  if (difficulty === "explorer") {
    const revealed = ordered.slice(0, Math.min(ordered.length, index + 1));
    const message = revealed.length === 1
      ? "One note is on the staff. Match that note."
      : "Two notes are on the staff. The last one is for your ear.";
    return { message, staffNotes: revealed, glowNotes: [] as string[] };
  }

  const revealed = ordered.slice(0, Math.min(ordered.length, index + 2));
  const shown = revealed[revealed.length - 1];
  const place = revealed.length >= ordered.length ? "highest" : "middle";
  return {
    message: `The ${place} note is ${fullName(shown)}.`,
    staffNotes: revealed,
    glowNotes: [shown],
  };
}

function stepAt(input: {
  mode: GameMode;
  difficulty: Difficulty;
  answer: string[];
  selected: string[];
  index: number;
  chord: HintChord;
}) {
  const building = input.mode === "learn" || input.mode === "see";
  if (building) return seeStep(input.difficulty, input.answer, input.selected, input.index, input.chord);
  if (input.mode === "note") return noteStep(input.difficulty, input.answer, input.index);
  return hearStep(input.difficulty, input.answer, input.index, input.chord);
}

export function hintView(input: {
  mode: GameMode;
  difficulty: Difficulty;
  answer: string[];
  selected: string[];
  hintsUsed: number;
  chord?: HintChord;
}): HintView {
  const budget = hintBudget(input.mode, input.difficulty);
  const hintsUsed = clampUsed(input.hintsUsed, budget);
  const chord = input.chord ?? EMPTY_CHORD;
  if (hintsUsed === 0) {
    if (input.mode === "hear") {
      const opening = hearOpening(input.difficulty, input.answer);
      return { ...opening, hintsUsed, budget };
    }
    return { message: null, staffNotes: [], glowNotes: [], hintsUsed, budget };
  }

  let staffNotes: string[] = [];
  let glowNotes: string[] = [];
  let message: string | null = null;
  for (let index = 0; index < hintsUsed; index += 1) {
    const step = stepAt({ ...input, index, chord });
    message = step.message;
    glowNotes = step.glowNotes;
    staffNotes = [...new Set([...staffNotes, ...step.staffNotes])];
  }
  return { message, staffNotes, glowNotes, hintsUsed, budget };
}
