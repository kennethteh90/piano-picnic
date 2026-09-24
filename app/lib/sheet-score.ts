import type { Clef } from "./staff-geometry";

/** One note in order for monophonic practice (quarter notes at fixed tempo). */
export type ScoreNote = {
  name: string;
  /** Beat index from start (0, 1, 2, …). */
  beat: number;
};

export type SheetScore = {
  clef: Clef;
  /** Default tempo for timing tolerance when comparing performance. */
  bpm: number;
  notes: ScoreNote[];
  title?: string;
};

export const DEFAULT_BPM = 72;

export function scoreFromNoteNames(names: string[], clef: Clef = "treble", bpm = DEFAULT_BPM, title?: string): SheetScore {
  return {
    clef,
    bpm,
    title,
    notes: names.map((name, beat) => ({ name, beat })),
  };
}

export function scoreNoteNames(score: SheetScore): string[] {
  return score.notes.map((n) => n.name);
}

/** Expected onset time in seconds from performance start. */
export function expectedOnsetSeconds(score: SheetScore, beat: number): number {
  return (beat * 60) / score.bpm;
}

export function beatDurationSeconds(score: SheetScore): number {
  return 60 / score.bpm;
}
