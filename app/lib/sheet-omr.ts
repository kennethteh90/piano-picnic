import { STAFF_STEP_PX, TREBLE_STAFF_POSITIONS, type Clef } from "./staff-geometry";
import { readPngKeywordJson } from "./png-metadata";
import { scoreFromNoteNames, type SheetScore } from "./sheet-score";

export type OmrResult = {
  score: SheetScore;
  source: "embedded" | "vision" | "manual";
  confidence: number;
  message?: string;
};

type EmbeddedPayload = {
  clef?: Clef;
  bpm?: number;
  notes?: string[];
  title?: string;
};

/** Layout constants for fixture / rendered practice sheets (640×220 PNG). */
export const SHEET_IMAGE_WIDTH = 640;
export const SHEET_IMAGE_HEIGHT = 220;
/** Staff inner height in px (matches .staff box in CSS, scaled). */
export const SHEET_STAFF_HEIGHT = 176;
export const SHEET_STAFF_TOP = 22;

const TREBLE_POSITION_TO_NOTE = Object.entries(TREBLE_STAFF_POSITIONS)
  .filter(([note]) => !note.includes("#") && !note.includes("b"))
  .map(([note, bottomPx]) => ({ note, bottomPx: bottomPx as number }));

function nearestTrebleNote(bottomPxFromStaffBottom: number): string {
  let best = TREBLE_POSITION_TO_NOTE[0];
  let bestDist = Infinity;
  for (const entry of TREBLE_POSITION_TO_NOTE) {
    const dist = Math.abs(entry.bottomPx - bottomPxFromStaffBottom);
    if (dist < bestDist) {
      bestDist = dist;
      best = entry;
    }
  }
  return best.note;
}

function grayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const o = i * 4;
    gray[i] = (0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2]) / 255;
  }
  return gray;
}

function findStaffLineRows(gray: Float32Array, width: number, height: number): number[] {
  const rowDark = new Float32Array(height);
  for (let y = 0; y < height; y += 1) {
    let dark = 0;
    for (let x = Math.floor(width * 0.12); x < Math.floor(width * 0.95); x += 1) {
      if (gray[y * width + x] < 0.55) dark += 1;
    }
    rowDark[y] = dark / (width * 0.83);
  }

  const lines: number[] = [];
  for (let y = 1; y < height - 1; y += 1) {
    if (rowDark[y] > 0.35 && rowDark[y] >= rowDark[y - 1] && rowDark[y] >= rowDark[y + 1]) {
      if (lines.length === 0 || y - lines.at(-1)! > 6) lines.push(y);
    }
  }

  if (lines.length >= 5) return lines.slice(0, 5);
  return [Math.floor(height * 0.42), Math.floor(height * 0.48), Math.floor(height * 0.54), Math.floor(height * 0.6), Math.floor(height * 0.66)];
}

/** Monophonic treble: dark blobs on staff → note names left-to-right. */
export function recognizeMonophonicTreble(imageData: ImageData): { notes: string[]; confidence: number } {
  const { width, height, data } = imageData;
  const gray = grayscale(data, width, height);
  const staffLines = findStaffLineRows(gray, width, height);
  const staffTop = staffLines[0];
  const staffBottom = staffLines[4];
  const staffHeight = staffBottom - staffTop;

  const blobs: { x: number; y: number; size: number }[] = [];
  const visited = new Uint8Array(width * height);
  const startX = Math.floor(width * 0.18);

  for (let y = staffTop - STAFF_STEP_PX; y <= staffBottom + STAFF_STEP_PX; y += 1) {
    for (let x = startX; x < width - 4; x += 1) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      if (gray[idx] > 0.35) continue;

      let size = 0;
      let sumX = 0;
      let sumY = 0;
      const stack = [idx];
      visited[idx] = 1;

      while (stack.length) {
        const cur = stack.pop()!;
        const cy = Math.floor(cur / width);
        const cx = cur % width;
        size += 1;
        sumX += cx;
        sumY += cy;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < startX || ny < staffTop - 20 || ny > staffBottom + 20) continue;
          const ni = ny * width + nx;
          if (visited[ni] || gray[ni] > 0.35) continue;
          visited[ni] = 1;
          stack.push(ni);
        }
      }

      if (size >= 8 && size <= 220) {
        blobs.push({ x: sumX / size, y: sumY / size, size });
      }
    }
  }

  blobs.sort((a, b) => a.x - b.x);

  const merged: typeof blobs = [];
  for (const b of blobs) {
    const prev = merged.at(-1);
    if (prev && Math.abs(prev.x - b.x) < 14 && Math.abs(prev.y - b.y) < 10) {
      prev.x = (prev.x + b.x) / 2;
      prev.y = (prev.y + b.y) / 2;
      prev.size += b.size;
    } else merged.push({ ...b });
  }

  const notes: string[] = [];
  for (const blob of merged) {
    const bottomFromStaffBottom = ((staffBottom - blob.y) / staffHeight) * SHEET_STAFF_HEIGHT;
    notes.push(nearestTrebleNote(bottomFromStaffBottom));
  }

  const confidence = notes.length > 0 ? Math.min(0.92, 0.55 + merged.length * 0.08) : 0;
  return { notes, confidence };
}

export async function extractScoreFromImageFile(file: File): Promise<OmrResult> {
  const buffer = await file.arrayBuffer();
  const embedded = readPngKeywordJson<EmbeddedPayload>(buffer, "ppScore");
  if (embedded?.notes?.length) {
    return {
      score: scoreFromNoteNames(embedded.notes, embedded.clef ?? "treble", embedded.bpm ?? 72, embedded.title),
      source: "embedded",
      confidence: 1,
      message: "Read the practice code hidden in this Piano Picnic sheet.",
    };
  }

  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read image");
  ctx.drawImage(bitmap, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  bitmap.close();

  const { notes, confidence } = recognizeMonophonicTreble(imageData);
  if (notes.length === 0) {
    return {
      score: scoreFromNoteNames([], "treble"),
      source: "vision",
      confidence: 0,
      message: "We could not find notes on this photo. Try a sample sheet or add notes by hand.",
    };
  }

  return {
    score: scoreFromNoteNames(notes, "treble", 72),
    source: "vision",
    confidence,
    message: confidence < 0.75 ? "Double-check the notes below — photo lighting can trick our reader." : undefined,
  };
}

export const BUILT_IN_SAMPLES: { id: string; title: string; notes: string[]; bpm?: number }[] = [
  { id: "c-scale", title: "C major scale (up)", notes: ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"] },
  { id: "mary", title: "Mary had a little lamb", notes: ["E4", "D4", "C4", "D4", "E4", "E4", "E4"] },
  { id: "ode", title: "Ode joy opening", notes: ["E4", "E4", "F4", "G4", "G4", "F4", "E4", "D4", "C4", "C4", "D4", "E4"] },
];
