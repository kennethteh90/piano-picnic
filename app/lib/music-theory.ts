// Pure music data and helpers shared by the game UI. No React or DOM here so
// the module stays unit-testable under plain `node --test`.

export type NoteName = "C" | "D" | "E" | "F" | "G" | "A" | "B";

export type ChordQuality = "major" | "minor" | "dominant";

export type SignatureKind = "sharp" | "flat";

// A key signature is the usual run of sharps or flats, not a courtesy accidental
// on each notehead. `count` is how far along the circle of fifths it goes.
export type KeySignature = {
  kind: SignatureKind;
  count: number;
};

export type Chord = {
  name: string;
  mood: string;
  quality: ChordQuality;
  root: NoteName;
  signature: KeySignature;
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

const SEMITONES: Record<NoteName, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

export function noteLetter(note: string) {
  return note[0] as NoteName;
}

const SHARP_ORDER: NoteName[] = ["F", "C", "G", "D", "A", "E", "B"];
const FLAT_ORDER: NoteName[] = ["B", "E", "A", "D", "G", "C", "F"];

export const EMPTY_SIGNATURE: KeySignature = { kind: "sharp", count: 0 };

export function signatureLetters(signature: KeySignature): NoteName[] {
  const order = signature.kind === "sharp" ? SHARP_ORDER : FLAT_ORDER;
  return order.slice(0, signature.count);
}

// Null when the signature already explains the note. A natural comes back only
// when the signature would otherwise change a printed natural.
export function noteAccidental(note: string, signature: KeySignature): "♯" | "♭" | "♮" | null {
  const signed = signatureLetters(signature).includes(noteLetter(note));
  if (note.includes("#")) return signature.kind === "sharp" && signed ? null : "♯";
  if (note.includes("b")) return signature.kind === "flat" && signed ? null : "♭";
  return signed ? "♮" : null;
}

export function noteToMidi(note: string) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(note);
  if (!match) throw new Error(`Unparseable note name: ${note}`);
  const letter = match[1] as NoteName;
  const accidental = match[2];
  const octave = Number(match[3]);
  return 12 * (octave + 1) + SEMITONES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
}

export function notesByPitch(notes: string[]) {
  return [...notes].sort((a, b) => noteToMidi(a) - noteToMidi(b));
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

export function gradeAnswer(selected: string[], answer: string[]) {
  if (selected.length !== answer.length) return "incomplete" as const;
  return sameNotes(selected, answer) ? "correct" as const : "incorrect" as const;
}

export const CHORDS: ChordFamily[] = [
  {
    name: "C major", mood: "home", quality: "major", root: "C", signature: { kind: "sharp", count: 0 }, notes: ["C3", "E3", "G3"], color: "#f3b72f", story: "Do, Mi, Sol make the home chord.",
    companion: { name: "G7", mood: "companion", quality: "dominant", root: "G", signature: { kind: "sharp", count: 0 }, notes: ["B2", "F3", "G3"], color: "#e29a37", story: "Ti, Fa, Sol make its companion. It wants to travel home to C major." },
  },
  {
    name: "G major", mood: "home", quality: "major", root: "G", signature: { kind: "sharp", count: 1 }, notes: ["G3", "B3", "D4"], color: "#e47662", story: "Sol, Ti, Re make the home chord.",
    companion: { name: "D7", mood: "companion", quality: "dominant", root: "D", signature: { kind: "sharp", count: 1 }, notes: ["F#3", "C4", "D4"], color: "#c85f54", story: "Fa-sharp, Do, Re make its companion. It wants to travel home to G major." },
  },
  {
    name: "F major", mood: "home", quality: "major", root: "F", signature: { kind: "flat", count: 1 }, notes: ["F3", "A3", "C4"], color: "#6f9d83", story: "Fa, La, Do make the home chord.",
    companion: { name: "C7", mood: "companion", quality: "dominant", root: "C", signature: { kind: "flat", count: 1 }, notes: ["E3", "Bb3", "C4"], color: "#527e68", story: "Mi, Ti-flat, Do make its companion. It wants to travel home to F major." },
  },
  {
    name: "D minor", mood: "home", quality: "minor", root: "D", signature: { kind: "flat", count: 1 }, notes: ["D3", "F3", "A3"], color: "#7676a8", story: "Re, Fa, La make the home chord.",
    companion: { name: "A7", mood: "companion", quality: "dominant", root: "A", signature: { kind: "sharp", count: 2 }, notes: ["C#3", "G3", "A3"], color: "#626293", story: "Do-sharp, Sol, La make its companion. It wants to travel home to D minor." },
  },
  {
    name: "A minor", mood: "home", quality: "minor", root: "A", signature: EMPTY_SIGNATURE, notes: ["A3", "C4", "E4"], color: "#4e8fa8", story: "La, Do, Mi make the home chord.",
    companion: { name: "E7", mood: "companion", quality: "dominant", root: "E", signature: { kind: "sharp", count: 3 }, notes: ["G#3", "D4", "E4"], color: "#3d748a", story: "Sol-sharp, Re, Mi make its companion. It wants to travel home to A minor." },
  },
];

export const CHALLENGE_CHORDS: Chord[] = CHORDS.flatMap((chord) => [chord, chord.companion]);
