// Shared helpers for converting note names ("C#4", "Bb3") to MIDI numbers.
const LETTER_SEMITONES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(note) {
  const match = /^([A-G])([#b]?)(\d)$/.exec(note);
  if (!match) throw new Error(`Unparseable note name: ${note}`);
  const [, letter, accidental, octave] = match;
  const semitone = LETTER_SEMITONES[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0);
  return 12 * (Number(octave) + 1) + semitone;
}
