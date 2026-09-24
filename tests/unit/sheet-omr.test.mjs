import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readPngKeywordJson } from "../../app/lib/png-metadata.ts";
import { recognizeMonophonicTreble } from "../../app/lib/sheet-omr.ts";
import { PNG } from "pngjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.join(__dirname, "../../public/fixtures/sheet-practice/c-major-scale.png");

test("fixture PNG carries embedded ppScore metadata", () => {
  const buffer = fs.readFileSync(fixturePath);
  const payload = readPngKeywordJson(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), "ppScore");
  assert.ok(payload?.notes?.length >= 4);
  assert.deepEqual(payload.notes.slice(0, 4), ["C4", "D4", "E4", "F4"]);
});

test("recognizeMonophonicTreble reads rendered noteheads from fixture", () => {
  const png = PNG.sync.read(fs.readFileSync(fixturePath));
  const imageData = {
    width: png.width,
    height: png.height,
    data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength),
  };
  const { notes, confidence } = recognizeMonophonicTreble(imageData);
  assert.ok(notes.length >= 4, `expected at least 4 notes, got ${notes.join(",")}`);
  assert.ok(confidence > 0.5);
  assert.equal(notes[0], "C4");
});
