// Optical music recognition for simple grand-staff notation. Finds treble and
// bass staves, groups noteheads into chords by horizontal position, and maps
// pitch in C major.

import { noteToMidi } from "./music-theory.ts";
import type { Clef } from "./staff-geometry.ts";

export type ScannedPitch = {
  note: string;
  staccato?: boolean;
  tiedFromPrevious?: boolean;
  tiedToNext?: boolean;
  slurredFromPrevious?: boolean;
  slurredToNext?: boolean;
};

export type ScannedEvent = {
  treble: ScannedPitch[];
  bass: ScannedPitch[];
};

export type SheetRecognitionSuccess = {
  ok: true;
  events: ScannedEvent[];
  pages?: number;
  warnings?: string[];
};

export type SheetRecognitionFailure = {
  ok: false;
  reason: string;
};

export type SheetRecognitionResult = SheetRecognitionSuccess | SheetRecognitionFailure;

export type RasterImage = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

const DIATONIC = ["C", "D", "E", "F", "G", "A", "B"] as const;

const TREBLE_PLAY_LOW = noteToMidi("C4");
const TREBLE_PLAY_HIGH = noteToMidi("E5");
const BASS_PLAY_LOW = noteToMidi("B2");
const BASS_PLAY_HIGH = noteToMidi("E4");

function isDark(data: Uint8ClampedArray, width: number, height: number, x: number, y: number) {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const index = (y * width + x) * 4;
  const luminance = 0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2];
  return luminance < 165;
}

function rowDensity(data: Uint8ClampedArray, width: number, height: number, y: number) {
  let dark = 0;
  for (let x = 0; x < width; x += 1) {
    if (isDark(data, width, height, x, y)) dark += 1;
  }
  return dark / width;
}

function staffLineCenters(data: Uint8ClampedArray, width: number, height: number) {
  const peaks: { y: number; density: number }[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    const density = rowDensity(data, width, height, y);
    if (density < 0.18) continue;
    const neighbors = rowDensity(data, width, height, y - 1) + rowDensity(data, width, height, y + 1);
    if (density >= neighbors / 2) peaks.push({ y, density });
  }

  peaks.sort((a, b) => a.y - b.y);
  const clusters: { y: number; density: number }[][] = [];
  let current: { y: number; density: number }[] = [];
  for (const peak of peaks) {
    if (current.length === 0 || peak.y - current[current.length - 1].y <= 4) {
      current.push(peak);
      continue;
    }
    clusters.push(current);
    current = [peak];
  }
  if (current.length > 0) clusters.push(current);

  return clusters
    .map((cluster) => cluster.reduce((best, point) => (point.density > best.density ? point : best), cluster[0]))
    .map((point) => point.y)
    .sort((a, b) => a - b);
}

function findStaffSystems(lineYs: number[], height: number) {
  if (lineYs.length < 5) return [] as number[][];

  const candidates: number[][] = [];
  for (let start = 0; start <= lineYs.length - 5; start += 1) {
    const window = lineYs.slice(start, start + 5);
    const spacings = window.slice(1).map((y, index) => y - window[index]);
    const average = spacings.reduce((sum, spacing) => sum + spacing, 0) / spacings.length;
    const variance = spacings.reduce((sum, spacing) => sum + (spacing - average) ** 2, 0) / spacings.length;
    if (variance > 6 || average < 6 || average > height / 3) continue;
    candidates.push(window);
  }

  const unique = candidates.filter((staff, index) => {
    const key = staff.join(",");
    return candidates.findIndex((other) => other.join(",") === key) === index;
  });

  unique.sort((a, b) => a[0] - b[0]);
  const chosen: number[][] = [];
  for (const staff of unique) {
    const overlaps = chosen.some((other) => {
      const gap = Math.min(Math.abs(staff[0] - other[4]), Math.abs(other[0] - staff[4]));
      const spacing = (staff[4] - staff[0]) / 4;
      return gap < spacing * 2.5;
    });
    if (!overlaps) chosen.push(staff);
  }
  return chosen.slice(0, 2);
}

function diatonicFromAnchor(anchorLetter: typeof DIATONIC[number], anchorOctave: number, stepsFromBottomLine: number) {
  let letterIndex = DIATONIC.indexOf(anchorLetter);
  let octave = anchorOctave;
  let remaining = stepsFromBottomLine;
  while (remaining > 0) {
    letterIndex += 1;
    if (letterIndex >= DIATONIC.length) {
      letterIndex = 0;
      octave += 1;
    }
    remaining -= 1;
  }
  while (remaining < 0) {
    letterIndex -= 1;
    if (letterIndex < 0) {
      letterIndex = DIATONIC.length - 1;
      octave -= 1;
    }
    remaining += 1;
  }
  return `${DIATONIC[letterIndex]}${octave}`;
}

function pitchFromStaff(clef: Clef, bottomLineY: number, lineSpacing: number, y: number) {
  const steps = Math.round((bottomLineY - y) / (lineSpacing / 2));
  if (clef === "treble") return diatonicFromAnchor("E", 4, steps);
  return diatonicFromAnchor("G", 2, steps);
}

function clampNote(note: string, clef: Clef) {
  const midi = noteToMidi(note);
  const low = clef === "treble" ? TREBLE_PLAY_LOW : BASS_PLAY_LOW;
  const high = clef === "treble" ? TREBLE_PLAY_HIGH : BASS_PLAY_HIGH;
  if (midi < low || midi > high) return null;
  return note;
}

function noteheadScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  radius: number,
) {
  let dark = 0;
  let total = 0;
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      total += 1;
      if (isDark(data, width, height, x + dx, y + dy)) dark += 1;
    }
  }
  return total === 0 ? 0 : dark / total;
}

function nearStaffLine(y: number, staffLines: number[]) {
  return staffLines.some((lineY) => Math.abs(lineY - y) <= 1);
}

function staccatoDotScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
  lineSpacing: number,
  noteRadius: number,
  staffLines: number[],
) {
  const dotRadius = Math.max(2, Math.round(lineSpacing / 7));
  const centerY = Math.round(y - lineSpacing * 0.5);
  if (nearStaffLine(centerY, staffLines)) return 0;
  if (y - centerY < noteRadius * 1.4) return 0;

  const dotFill = noteheadScore(data, width, height, x, centerY, dotRadius);
  const headScore = noteheadScore(data, width, height, x, y, noteRadius);
  const haloScore = noteheadScore(data, width, height, x, centerY, noteRadius);
  if (dotFill < 0.65 || headScore < 0.55) return 0;
  if (haloScore >= headScore - 0.12) return 0;

  let horizontalRun = 0;
  let maxHorizontalRun = 0;
  for (let dx = -Math.round(lineSpacing * 0.55); dx <= Math.round(lineSpacing * 0.55); dx += 1) {
    if (isDark(data, width, height, x + dx, centerY)) {
      horizontalRun += 1;
      maxHorizontalRun = Math.max(maxHorizontalRun, horizontalRun);
    } else horizontalRun = 0;
  }
  if (maxHorizontalRun > dotRadius * 2.5) return 0;
  return dotFill;
}

function expectedTieArcY(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineSpacing: number,
  x: number,
) {
  const baseY = Math.min(y1, y2) - Math.round(lineSpacing * 0.2);
  const bulge = lineSpacing * 0.38;
  const t = (x - x1) / (x2 - x1);
  return Math.round(baseY - Math.sin(t * Math.PI) * bulge);
}

function filterArcArtifactNoteheads(
  heads: DetectedHead[],
  data: Uint8ClampedArray,
  width: number,
  height: number,
  lineSpacing: number,
  toNote: (y: number) => string | null,
) {
  const sorted = [...heads].sort((a, b) => a.x - b.x);
  return heads.filter((head) => {
    const headNote = toNote(head.y);
    if (!headNote) return true;
    for (let leftIndex = 0; leftIndex < sorted.length - 1; leftIndex += 1) {
      const left = sorted[leftIndex];
      const leftNote = toNote(left.y);
      if (!leftNote) continue;
      for (let rightIndex = leftIndex + 1; rightIndex < sorted.length; rightIndex += 1) {
        const right = sorted[rightIndex];
        const rightNote = toNote(right.y);
        if (!rightNote) continue;
        if (head.x <= left.x || head.x >= right.x) continue;
        const arc = phraseArcScore(data, width, height, left.x, left.y, right.x, right.y, lineSpacing);
        if (arc < 0.15) continue;
        const arcY = expectedTieArcY(left.x, left.y, right.x, right.y, lineSpacing, head.x);
        if (Math.abs(head.y - arcY) > lineSpacing * 0.45) continue;
        if (leftNote === rightNote) {
          if (headNote !== leftNote) return false;
          continue;
        }
        if (headNote !== leftNote && headNote !== rightNote) return false;
      }
    }
    return true;
  });
}

function phraseArcScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineSpacing: number,
  maxPitchDelta = lineSpacing * 4,
  sampleRadius = 2,
) {
  if (x2 - x1 < lineSpacing * 0.35) return 0;
  if (Math.abs(y1 - y2) > maxPitchDelta) return 0;
  const baseY = Math.min(y1, y2) - Math.round(lineSpacing * 0.2);
  const bulge = lineSpacing * 0.38;
  let dark = 0;
  let total = 0;
  for (let x = Math.floor(x1 + lineSpacing * 0.2); x <= Math.ceil(x2 - lineSpacing * 0.2); x += 1) {
    const t = (x - x1) / (x2 - x1);
    const arcY = Math.round(baseY - Math.sin(t * Math.PI) * bulge);
    for (let dy = -sampleRadius; dy <= sampleRadius; dy += 1) {
      total += 1;
      if (isDark(data, width, height, x, arcY + dy)) dark += 1;
    }
  }
  return total === 0 ? 0 : dark / total;
}

function tieArcScore(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  lineSpacing: number,
) {
  return phraseArcScore(data, width, height, x1, y1, x2, y2, lineSpacing, lineSpacing * 0.3, 1);
}

function markTies(
  heads: DetectedHead[],
  data: Uint8ClampedArray,
  width: number,
  height: number,
  lineSpacing: number,
  toNote: (y: number) => string | null,
) {
  const sorted = [...heads].sort((a, b) => a.x - b.x);
  for (let index = 0; index < sorted.length; index += 1) {
    const left = sorted[index];
    const leftNote = toNote(left.y);
    if (!leftNote) continue;
    for (let rightIndex = index + 1; rightIndex < sorted.length; rightIndex += 1) {
      const right = sorted[rightIndex];
      const rightNote = toNote(right.y);
      if (rightNote !== leftNote) continue;
      if (right.x - left.x > lineSpacing * 6) break;
      const arc = tieArcScore(data, width, height, left.x, left.y, right.x, right.y, lineSpacing);
      if (arc < 0.2) continue;
      left.tiedToNext = true;
      right.tiedFromPrevious = true;
      break;
    }
  }
}

function markSlurs(
  heads: DetectedHead[],
  data: Uint8ClampedArray,
  width: number,
  height: number,
  lineSpacing: number,
  toNote: (y: number) => string | null,
) {
  const sorted = [...heads].sort((a, b) => a.x - b.x);
  for (let index = 0; index < sorted.length - 1; index += 1) {
    const left = sorted[index];
    const right = sorted[index + 1];
    const leftNote = toNote(left.y);
    const rightNote = toNote(right.y);
    if (!leftNote || !rightNote || leftNote === rightNote) continue;
    if (left.tiedToNext || right.tiedFromPrevious) continue;
    if (right.x - left.x > lineSpacing * 7) continue;
    const arc = phraseArcScore(data, width, height, left.x, left.y, right.x, right.y, lineSpacing);
    if (arc < 0.32) continue;
    left.slurredToNext = true;
    right.slurredFromPrevious = true;
  }
}

type DetectedHead = {
  x: number;
  y: number;
  staccato: boolean;
  tiedFromPrevious?: boolean;
  tiedToNext?: boolean;
  slurredFromPrevious?: boolean;
  slurredToNext?: boolean;
};

function detectNoteheads(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  staffLines: number[],
) {
  const top = staffLines[0];
  const bottom = staffLines[4];
  const lineSpacing = (bottom - top) / 4;
  const radius = Math.max(2, Math.round(lineSpacing / 5));
  const threshold = 0.4;
  const candidates: DetectedHead[] = [];

  for (let x = Math.round(lineSpacing); x < width - lineSpacing; x += Math.max(2, Math.round(lineSpacing / 6))) {
    for (let y = Math.round(top - lineSpacing); y <= Math.round(bottom + lineSpacing); y += 1) {
      const onLine = staffLines.some((lineY) => Math.abs(lineY - y) <= 1);
      if (onLine) continue;
      const score = noteheadScore(data, width, height, x, y, radius);
      if (score < threshold) continue;
      const above = noteheadScore(data, width, height, x, y - 1, radius);
      const below = noteheadScore(data, width, height, x, y + 1, radius);
      if (score < above || score < below) continue;
      candidates.push({ x, y, staccato: false });
    }
  }

  const deduped: DetectedHead[] = [];
  for (const point of candidates) {
    const duplicate = deduped.find(
      (other) => Math.abs(other.x - point.x) <= radius && Math.abs(other.y - point.y) <= radius,
    );
    if (!duplicate) deduped.push(point);
  }
  for (const head of deduped) {
    head.staccato =
      staccatoDotScore(data, width, height, head.x, head.y, lineSpacing, radius, staffLines) > 0;
  }
  return deduped;
}

function staffForPoint(pointY: number, systems: number[][]) {
  let best: { staff: number[]; distance: number } | null = null;
  for (const staff of systems) {
    const top = staff[0];
    const bottom = staff[4];
    const spacing = (bottom - top) / 4;
    if (pointY < top - spacing || pointY > bottom + spacing) continue;
    const center = (top + bottom) / 2;
    const distance = Math.abs(pointY - center);
    if (!best || distance < best.distance) best = { staff, distance };
  }
  return best?.staff ?? null;
}

function clefForStaff(staff: number[], systems: number[][], imageHeight: number): Clef {
  if (systems.length === 1) return (staff[0] + staff[4]) / 2 < imageHeight * 0.52 ? "treble" : "bass";
  return systems.indexOf(staff) === 0 ? "treble" : "bass";
}

type TimedNotes = { x: number; notes: ScannedPitch[] };

function toPitch(head: DetectedHead, note: string): ScannedPitch {
  const pitch: ScannedPitch = { note };
  if (head.staccato) pitch.staccato = true;
  if (head.tiedFromPrevious) pitch.tiedFromPrevious = true;
  if (head.tiedToNext) pitch.tiedToNext = true;
  if (head.slurredFromPrevious) pitch.slurredFromPrevious = true;
  if (head.slurredToNext) pitch.slurredToNext = true;
  return pitch;
}

function groupTimedNotes(
  heads: DetectedHead[],
  lineSpacing: number,
  toNote: (y: number) => string | null,
) {
  const sorted = [...heads].sort((a, b) => a.x - b.x);
  const groups: TimedNotes[] = [];
  const bucket = lineSpacing * 0.55;

  for (const head of sorted) {
    const note = toNote(head.y);
    if (!note) continue;
    const group = groups.find((entry) => Math.abs(entry.x - head.x) < bucket);
    if (!group) {
      groups.push({ x: head.x, notes: [toPitch(head, note)] });
      continue;
    }
    const existing = group.notes.find((pitch) => pitch.note === note);
    if (existing) {
      if (head.staccato) existing.staccato = true;
      if (head.tiedFromPrevious) existing.tiedFromPrevious = true;
      if (head.tiedToNext) existing.tiedToNext = true;
      if (head.slurredFromPrevious) existing.slurredFromPrevious = true;
      if (head.slurredToNext) existing.slurredToNext = true;
      group.x = Math.round((group.x + head.x) / 2);
      continue;
    }
    group.notes.push(toPitch(head, note));
    group.x = Math.round((group.x + head.x) / 2);
  }

  return groups.sort((a, b) => a.x - b.x);
}

function mergeGrandStaffEvents(treble: TimedNotes[], bass: TimedNotes[], tolerance: number): ScannedEvent[] {
  const anchors = [...new Set([...treble.map((entry) => entry.x), ...bass.map((entry) => entry.x)])].sort((a, b) => a - b);
  const clusters: number[] = [];
  for (const x of anchors) {
    const last = clusters.at(-1);
    if (last !== undefined && x - last < tolerance) clusters[clusters.length - 1] = Math.round((last + x) / 2);
    else clusters.push(x);
  }

  return clusters.map((x) => ({
    treble: treble.find((entry) => Math.abs(entry.x - x) < tolerance)?.notes ?? [] as ScannedPitch[],
    bass: bass.find((entry) => Math.abs(entry.x - x) < tolerance)?.notes ?? [] as ScannedPitch[],
  })).filter((event) => event.treble.length > 0 || event.bass.length > 0);
}

function collapseDuplicateEvents(events: ScannedEvent[]) {
  const cleaned: ScannedEvent[] = [];
  for (const event of events) {
    const last = cleaned.at(-1);
    if (last && sameEvent(last, event)) continue;
    cleaned.push(event);
  }
  return cleaned;
}

function sameEvent(a: ScannedEvent, b: ScannedEvent) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function recognizeSheetFromImageData(image: RasterImage): SheetRecognitionResult {
  const { data, width, height } = image;
  if (width < 120 || height < 80) {
    return { ok: false, reason: "The picture is too small. Move closer to the music." };
  }

  const lineYs = staffLineCenters(data, width, height);
  const systems = findStaffSystems(lineYs, height);
  if (systems.length === 0) {
    return { ok: false, reason: "Could not find a staff. Frame treble and bass clefs with clear noteheads." };
  }

  const trebleTimed: TimedNotes[] = [];
  const bassTimed: TimedNotes[] = [];
  let mergeTolerance = 24;

  for (const staff of systems) {
    const lineSpacing = (staff[4] - staff[0]) / 4;
    mergeTolerance = Math.max(mergeTolerance, lineSpacing * 0.65);
    const clef = clefForStaff(staff, systems, height);
    const toNote = (y: number) => clampNote(pitchFromStaff(clef, staff[4], lineSpacing, y), clef);
    let heads = detectNoteheads(data, width, height, staff).filter((head) => staffForPoint(head.y, systems) === staff);
    heads = filterArcArtifactNoteheads(heads, data, width, height, lineSpacing, toNote);
    markTies(heads, data, width, height, lineSpacing, toNote);
    markSlurs(heads, data, width, height, lineSpacing, toNote);
    const timed = groupTimedNotes(heads, lineSpacing, toNote);
    if (clef === "treble") trebleTimed.push(...timed);
    else bassTimed.push(...timed);
  }

  const events = collapseDuplicateEvents(mergeGrandStaffEvents(trebleTimed, bassTimed, mergeTolerance));
  if (events.length === 0) {
    return { ok: false, reason: "No playable notes found. Try brighter light and simpler chords in C major." };
  }

  return { ok: true, events, pages: 1 };
}

export function mergeSheetPages(results: SheetRecognitionResult[]): SheetRecognitionResult {
  if (results.length === 0) {
    return { ok: false, reason: "Choose at least one page image." };
  }

  const successes: SheetRecognitionSuccess[] = [];
  const warnings: string[] = [];
  for (const [index, result] of results.entries()) {
    if (result.ok) successes.push(result);
    else warnings.push(`Page ${index + 1}: ${result.reason}`);
  }

  if (successes.length === 0) {
    const first = warnings[0] ?? "Could not read any pages.";
    return { ok: false, reason: first.replace(/^Page \d+: /, "") };
  }

  const events = successes.flatMap((page) => page.events);
  return {
    ok: true,
    events,
    pages: successes.length,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}
