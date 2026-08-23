// Pure music data and helpers shared by the game UI. No React or DOM here so
// the module stays unit-testable under plain `node --test`.

export type NoteName = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export type Chord = {
  name: string;
  mood: string;
  notes: string[];
  color: string;
  story: string;
};

export type ChordFamily = Chord & {
  companion: Chord;
};

export type BlackKeyInfo = { note: string; letter: string; solfege: string };

export const SOLFEGE: Record<NoteName, string> = {
  C: "Do",
  D: "Re",
  E: "Mi",
  F: "Fa",
  G: "Sol",
  A: "La",
  B: "Ti",
};

export const TREBLE_KEYS = [
  "C4", "D4", "E4", "F4", "G4", "A4", "B4",
  "C5", "D5", "E5",
];

export const BASS_KEYS = [
  "B2",
  "C3", "D3", "E3", "F3", "G3", "A3", "B3",
  "C4", "D4", "E4",
];

export const NOTE_ROUNDS = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"];

export function getBlackKeys(register: "treble" | "bass"): Record<number, BlackKeyInfo> {
  const lowOctave = register === "treble" ? 4 : 3;
  const offset = register === "treble" ? 0 : 1;
  return {
    [offset]: { note: `C#${lowOctave}`, letter: "C♯", solfege: "Do♯" },
    [offset + 1]: { note: `D#${lowOctave}`, letter: "D♯", solfege: "Re♯" },
    [offset + 3]: { note: `F#${lowOctave}`, letter: "F♯", solfege: "Fa♯" },
    [offset + 4]: { note: `G#${lowOctave}`, letter: "G♯", solfege: "Sol♯" },
    [offset + 5]: { note: `Bb${lowOctave}`, letter: "B♭", solfege: "Ti♭" },
    [offset + 7]: { note: `C#${lowOctave + 1}`, letter: "C♯", solfege: "Do♯" },
    [offset + 8]: { note: `D#${lowOctave + 1}`, letter: "D♯", solfege: "Re♯" },
  };
}

// Fisher-Yates shuffle of [0, length); optionally avoids dealing the given
// index first so players never see the same question twice in a row.
export function shuffledIndices(length: number, avoidFirst?: number) {
  const indices = Array.from({ length }, (_, index) => index);
  for (let index = indices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indices[index], indices[swapIndex]] = [indices[swapIndex], indices[index]];
  }
  if (indices.length > 1 && indices[0] === avoidFirst) {
    [indices[0], indices[1]] = [indices[1], indices[0]];
  }
  return indices;
}

export function noteLetter(note: string) {
  return note[0] as NoteName;
}

export function prettyNotes(notes: string[]) {
  return notes.map((note) => {
    const accidental = note.includes("#") ? "♯" : note.includes("b") ? "♭" : "";
    const letter = noteLetter(note);
    return `${letter}${accidental} · ${SOLFEGE[letter]}${accidental}`;
  });
}

export function sameNotes(a: string[], b: string[]) {
  return a.length === b.length && [...a].sort().every((note, index) => note === [...b].sort()[index]);
}

export const CHORDS: ChordFamily[] = [
  {
    name: "C major", mood: "home", notes: ["C3", "E3", "G3"], color: "#f3b72f", story: "Do, Mi, Sol make the home chord.",
    companion: { name: "G7", mood: "companion", notes: ["B2", "F3", "G3"], color: "#e29a37", story: "Ti, Fa, Sol make its companion. It wants to travel home to C major." },
  },
  {
    name: "G major", mood: "home", notes: ["G3", "B3", "D4"], color: "#e47662", story: "Sol, Ti, Re make the home chord.",
    companion: { name: "D7", mood: "companion", notes: ["F#3", "C4", "D4"], color: "#c85f54", story: "Fa-sharp, Do, Re make its companion. It wants to travel home to G major." },
  },
  {
    name: "F major", mood: "home", notes: ["F3", "A3", "C4"], color: "#6f9d83", story: "Fa, La, Do make the home chord.",
    companion: { name: "C7", mood: "companion", notes: ["E3", "Bb3", "C4"], color: "#527e68", story: "Mi, Ti-flat, Do make its companion. It wants to travel home to F major." },
  },
  {
    name: "D minor", mood: "home", notes: ["D3", "F3", "A3"], color: "#7676a8", story: "Re, Fa, La make the home chord.",
    companion: { name: "A7", mood: "companion", notes: ["C#3", "G3", "A3"], color: "#626293", story: "Do-sharp, Sol, La make its companion. It wants to travel home to D minor." },
  },
  {
    name: "A minor", mood: "home", notes: ["A3", "C4", "E4"], color: "#4e8fa8", story: "La, Do, Mi make the home chord.",
    companion: { name: "E7", mood: "companion", notes: ["G#3", "D4", "E4"], color: "#3d748a", story: "Sol-sharp, Re, Mi make its companion. It wants to travel home to A minor." },
  },
];

export const CHALLENGE_CHORDS: Chord[] = CHORDS.flatMap((chord) => [chord, chord.companion]);
