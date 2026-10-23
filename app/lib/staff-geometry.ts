// Staff geometry shared by the Staff component. Positions are pixel offsets
// from the bottom of the staff box. Each diatonic step is exactly 8px: staff
// lines are 16px apart, with the notes between them centered at the halfway
// point.

import type { NoteName, SignatureKind } from "./music-theory.ts";

export type Clef = "treble" | "bass";

export const STAFF_STEP_PX = 8;

// The staff box is 176px tall. The five lines sit in a 66px block whose top
// is 42px down, so the top line is 134px from the bottom and the bottom line
// is 70px from the bottom. A notehead is 14px tall; its center is 7px above
// the `bottom` offset stored in the position maps.
export const STAFF_TOP_LINE = 134;
export const STAFF_BOTTOM_LINE = 70;
export const NOTEHEAD_CENTER_OFFSET = 7;

export const TREBLE_STAFF_POSITIONS: Record<string, number> = {
  C4: 47, "C#4": 47, D4: 55, E4: 63, F4: 71, "F#4": 71,
  G4: 79, "G#4": 79, A4: 87, B4: 95, Bb4: 95,
  C5: 103, D5: 111, E5: 119, F5: 127, G5: 135, A5: 143, B5: 151, C6: 159,
};

export const BASS_STAFF_POSITIONS: Record<string, number> = {
  B2: 79, C3: 87, "C#3": 87, D3: 95, E3: 103, F3: 111, "F#3": 111,
  G3: 119, "G#3": 119, A3: 127, B3: 135, Bb3: 135,
  C4: 143, "C#4": 143, D4: 151, E4: 159,
};

export function staffPositions(clef: Clef): Record<string, number> {
  return clef === "treble" ? TREBLE_STAFF_POSITIONS : BASS_STAFF_POSITIONS;
}

// One horizontal ledger for each staff line outside the five-line staff,
// measured as the line's center from the bottom of the staff box. A chord
// shares a line instead of each notehead growing its own stub.
export function ledgerCenters(clef: Clef, notes: string[]): number[] {
  const positions = staffPositions(clef);
  const centers = new Set<number>();
  for (const note of notes) {
    const center = (positions[note] ?? 40) + NOTEHEAD_CENTER_OFFSET;
    if (center > STAFF_TOP_LINE) {
      for (let line = STAFF_TOP_LINE + 16; line <= center + 0.5; line += 16) centers.add(line);
    } else if (center < STAFF_BOTTOM_LINE) {
      for (let line = STAFF_BOTTOM_LINE - 16; line >= center - 0.5; line -= 16) centers.add(line);
    }
  }
  return [...centers].sort((a, b) => a - b);
}

// Where a signature accidental sits: the usual octave beside the clef, not
// the octave of the chord tone it applies to.
const SIGNATURE_PITCH: Record<Clef, Record<SignatureKind, Record<NoteName, string>>> = {
  treble: {
    sharp: { F: "F5", C: "C5", G: "G5", D: "D5", A: "A4", E: "E5", B: "B4" },
    flat: { B: "B4", E: "E5", A: "A4", D: "D5", G: "G4", C: "C5", F: "F4" },
  },
  bass: {
    sharp: { F: "F3", C: "C3", G: "G3", D: "D3", A: "A3", E: "E3", B: "B2" },
    flat: { B: "B2", E: "E3", A: "A3", D: "D3", G: "G3", C: "C3", F: "F3" },
  },
};

export function signaturePitch(clef: Clef, letter: NoteName, kind: SignatureKind) {
  return SIGNATURE_PITCH[clef][kind][letter];
}
