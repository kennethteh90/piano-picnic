import assert from "node:assert/strict";
import test from "node:test";
import { mergeSheetPages, recognizeSheetFromImageData } from "../../app/lib/sheet-recognition.ts";

function fillWhite(data, width, height) {
  for (let index = 0; index < width * height * 4; index += 4) {
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
    data[index + 3] = 255;
  }
}

function drawHorizontalLine(data, width, height, y) {
  for (let x = 0; x < width; x += 1) {
    const index = (y * width + x) * 4;
    data[index] = 0;
    data[index + 1] = 0;
    data[index + 2] = 0;
    data[index + 3] = 255;
  }
}

function drawFilledCircle(data, width, height, centerX, centerY, radius) {
  for (let y = centerY - radius; y <= centerY + radius; y += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) {
      if ((x - centerX) ** 2 + (y - centerY) ** 2 > radius ** 2) continue;
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const index = (y * width + x) * 4;
      data[index] = 0;
      data[index + 1] = 0;
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  }
}

function drawStaff(data, width, staffTop, lineSpacing) {
  const staffLines = Array.from({ length: 5 }, (_, index) => staffTop + index * lineSpacing);
  for (const y of staffLines) drawHorizontalLine(data, width, data.length / (width * 4), y);
  return staffLines;
}

function syntheticTrebleMelody(notes, width = 480, height = 220) {
  const data = new Uint8ClampedArray(width * height * 4);
  fillWhite(data, width, height);
  const staffTop = 70;
  const lineSpacing = 18;
  const staffLines = drawStaff(data, width, staffTop, lineSpacing);
  const bottomLine = staffLines[4];
  for (const note of notes) {
    const y = Math.round(bottomLine - note.step * (lineSpacing / 2));
    drawFilledCircle(data, width, height, note.x, y, 7);
  }
  return { data, width, height };
}

function syntheticGrandStaff(events, width = 480, height = 360) {
  const data = new Uint8ClampedArray(width * height * 4);
  fillWhite(data, width, height);
  const lineSpacing = 18;
  const trebleTop = 48;
  const bassTop = 188;
  const trebleLines = drawStaff(data, width, trebleTop, lineSpacing);
  const bassLines = drawStaff(data, width, bassTop, lineSpacing);
  for (const event of events) {
    for (const note of event.treble ?? []) {
      const y = Math.round(trebleLines[4] - note.step * (lineSpacing / 2));
      drawFilledCircle(data, width, height, event.x, y, 7);
    }
    for (const note of event.bass ?? []) {
      const y = Math.round(bassLines[4] - note.step * (lineSpacing / 2));
      drawFilledCircle(data, width, height, event.x, y, 7);
    }
  }
  return { data, width, height };
}

test("recognizes a simple treble melody from a synthetic staff image", () => {
  const image = syntheticTrebleMelody([
    { x: 120, step: 0 },
    { x: 180, step: 1 },
    { x: 240, step: 2 },
    { x: 300, step: 3 },
  ]);
  const result = recognizeSheetFromImageData(image);
  assert.equal(result.ok, true);
  assert.deepEqual(result.events, [
    { treble: ["E4"], bass: [] },
    { treble: ["F4"], bass: [] },
    { treble: ["G4"], bass: [] },
    { treble: ["A4"], bass: [] },
  ]);
});

test("groups vertically stacked noteheads into one chord", () => {
  const image = syntheticTrebleMelody([
    { x: 160, step: 4 },
    { x: 162, step: 2 },
    { x: 164, step: 0 },
  ]);
  const result = recognizeSheetFromImageData(image);
  assert.equal(result.ok, true);
  assert.equal(result.events.length, 1);
  assert.deepEqual(result.events[0].treble.sort(), ["E4", "G4", "B4"].sort());
});

test("reads treble and bass staves into aligned chord events", () => {
  const image = syntheticGrandStaff([
    { x: 180, treble: [{ step: 2 }], bass: [{ step: 4 }] },
    { x: 260, treble: [{ step: 3 }], bass: [{ step: 2 }] },
  ]);
  const result = recognizeSheetFromImageData(image);
  assert.equal(result.ok, true);
  assert.equal(result.events.length, 2);
  assert.deepEqual(result.events[0], { treble: ["G4"], bass: ["D3"] });
  assert.deepEqual(result.events[1], { treble: ["A4"], bass: ["B2"] });
});

test("merges multiple page results in upload order", () => {
  const merged = mergeSheetPages([
    { ok: true, events: [{ treble: ["C4"], bass: [] }], pages: 1 },
    { ok: true, events: [{ treble: ["D4"], bass: ["G3"] }], pages: 1 },
    { ok: false, reason: "No notes found." },
  ]);
  assert.equal(merged.ok, true);
  assert.equal(merged.pages, 2);
  assert.deepEqual(merged.events, [
    { treble: ["C4"], bass: [] },
    { treble: ["D4"], bass: ["G3"] },
  ]);
  assert.equal(merged.warnings?.length, 1);
});

test("reports a helpful message when no staff is visible", () => {
  const data = new Uint8ClampedArray(200 * 120 * 4);
  fillWhite(data, 200, 120);
  const result = recognizeSheetFromImageData({ data, width: 200, height: 120 });
  assert.equal(result.ok, false);
  assert.match(result.reason, /staff/i);
});
