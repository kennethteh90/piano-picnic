// Staff geometry shared by the Staff component. Positions are pixel offsets
// from the bottom of the staff box. Each diatonic step is exactly 8px: staff
// lines are 16px apart, with the notes between them centered at the halfway
// point.

export type Clef = "treble" | "bass";

export const STAFF_STEP_PX = 8;

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

/** Horizontal bounds of `.staff-lines` in the Staff component (percent of staff width). */
export const STAFF_NOTE_AREA_LEFT_PCT = 13;
export const STAFF_NOTE_AREA_RIGHT_INSET_PCT = 4;

/** Even horizontal spacing for monophonic melodies (sheet practice preview). */
export function sequenceNoteLeftPercent(index: number, total: number): number {
  if (total <= 0) return 54;
  if (total === 1) return 54;
  const rightEdge = 100 - STAFF_NOTE_AREA_RIGHT_INSET_PCT;
  const span = rightEdge - STAFF_NOTE_AREA_LEFT_PCT;
  return STAFF_NOTE_AREA_LEFT_PCT + (index / (total - 1)) * span;
}

// Ledger lines drawn above/below the staff for notes sitting on or beyond the
// edge ledger positions.
export function ledgerOffsets(clef: Clef, note: string): number[] {
  if (clef === "treble") return note === "C4" || note === "C#4" ? [6] : [];
  if (note === "C4" || note === "C#4") return [6];
  if (note === "D4") return [14];
  if (note === "E4") return [6, 22];
  return [];
}
