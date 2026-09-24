// MIDI and pitch helpers for sheet practice (no DOM).

const LETTER_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(note: string): number {
  const match = /^([A-G])([#b]?)(\d)$/.exec(note);
  if (!match) throw new Error(`Unparseable note name: ${note}`);
  const [, letter, accidental, octave] = match;
  const semitone = LETTER_SEMITONES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return 12 * (Number(octave) + 1) + semitone;
}

export function midiToNote(midi: number): string {
  const octave = Math.floor(midi / 12) - 1;
  const pitchClass = ((midi % 12) + 12) % 12;
  const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;
  return `${names[pitchClass]}${octave}`;
}

export function frequencyToMidi(frequency: number): number {
  if (!Number.isFinite(frequency) || frequency <= 0) return NaN;
  return 69 + 12 * Math.log2(frequency / 440);
}

/** Cents deviation between two MIDI values (absolute). */
export function midiCentsApart(a: number, b: number): number {
  return Math.abs(a - b) * 100;
}

export function midiMatchesExpected(detectedMidi: number, expectedNote: string, centsTolerance = 50): boolean {
  if (!Number.isFinite(detectedMidi)) return false;
  const expected = noteToMidi(expectedNote);
  return midiCentsApart(detectedMidi, expected) <= centsTolerance;
}
