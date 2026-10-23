// Tone choices for the sampler. Grand is the Splendid grand piano. Organ is a
// drawbar registration from a free General MIDI soundfont, the closest open
// stand-in for an Electone; Yamaha Electone recordings are not available to ship.

export const PIANO_TONES = [
  { id: "upright", label: "Upright" },
  { id: "grand", label: "Grand" },
  { id: "organ", label: "Organ" },
] as const;

export type PianoTone = (typeof PIANO_TONES)[number]["id"];

export const ORGAN_INSTRUMENT = "drawbar_organ";
export const ORGAN_KIT = "MusyngKite";

// The game plays B2 (47) through E5 (76). Include the neighboring sampled
// roots so the grand piano still has a sample for the notes at each end.
export function gameMidiNotes() {
  return Array.from({ length: 76 - 45 + 1 }, (_, index) => 45 + index);
}

// One velocity layer covers the velocities the game actually sends.
export const GRAND_VELOCITY_RANGE: [number, number] = [68, 84];
