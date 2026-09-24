#!/usr/bin/env node
/**
 * Renders simple monophonic treble PNG fixtures with embedded ppScore metadata.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
const TREBLE_STAFF_POSITIONS = {
  C4: 47, D4: 55, E4: 63, F4: 71, G4: 79, A4: 87, B4: 95, C5: 103,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "../public/fixtures/sheet-practice");

const WIDTH = 640;
const HEIGHT = 220;
const STAFF_HEIGHT = 176;
const STAFF_TOP = 22;
const STAFF_BOTTOM = STAFF_TOP + STAFF_HEIGHT - 16;

const NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function embedPngWithText(rgba, meta) {
  const png = new PNG({ width: WIDTH, height: HEIGHT });
  png.data = Buffer.from(rgba);
  const raw = PNG.sync.write(png);
  const iend = raw.length - 12;
  const textChunk = chunk("tEXt", Buffer.concat([
    Buffer.from("ppScore\0"),
    Buffer.from(JSON.stringify(meta)),
  ]));
  return Buffer.concat([raw.subarray(0, iend), textChunk, raw.subarray(iend)]);
}

function yForNote(note) {
  const bottomPx = TREBLE_STAFF_POSITIONS[note] ?? 80;
  return STAFF_BOTTOM - (bottomPx / STAFF_HEIGHT) * (STAFF_BOTTOM - STAFF_TOP);
}

function drawFixture() {
  const rgba = Buffer.alloc(WIDTH * HEIGHT * 4, 255);
  const paper = [255, 253, 248];
  const line = [200, 195, 184];
  const ink = [36, 49, 40];

  const set = (x, y, rgb) => {
    if (x < 0 || y < 0 || x >= WIDTH || y >= HEIGHT) return;
    const i = (y * WIDTH + x) * 4;
    rgba[i] = rgb[0];
    rgba[i + 1] = rgb[1];
    rgba[i + 2] = rgb[2];
    rgba[i + 3] = 255;
  };

  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) set(x, y, paper);
  }

  for (let lineIndex = 0; lineIndex < 5; lineIndex += 1) {
    const y = STAFF_TOP + lineIndex * 16;
    for (let x = Math.floor(WIDTH * 0.08); x < Math.floor(WIDTH * 0.92); x += 1) {
      for (let dy = 0; dy < 2; dy += 1) set(x, y + dy, line);
    }
  }

  NOTES.forEach((note, index) => {
    const cx = Math.floor(WIDTH * 0.22 + index * (WIDTH * 0.68 / NOTES.length));
    const cy = Math.floor(yForNote(note));
    for (let dy = -5; dy <= 5; dy += 1) {
      for (let dx = -6; dx <= 4; dx += 1) {
        if ((dx * dx) / 36 + (dy * dy) / 25 <= 1) set(cx + dx, cy + dy, ink);
      }
    }
  });

  return rgba;
}

fs.mkdirSync(outDir, { recursive: true });
const rgba = drawFixture();
const out = embedPngWithText(rgba, {
  clef: "treble",
  bpm: 72,
  title: "C major scale (up)",
  notes: NOTES,
});
fs.writeFileSync(path.join(outDir, "c-major-scale.png"), out);
console.log("Wrote c-major-scale.png");
