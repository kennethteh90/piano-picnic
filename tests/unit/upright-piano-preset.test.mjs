import assert from "node:assert/strict";
import test from "node:test";
import { SAMPLE_LIBRARY_URL, UPRIGHT_PRESET } from "../../app/lib/upright-piano-preset.ts";
import { BASS_KEYS, TREBLE_KEYS } from "../../app/lib/music-theory.ts";
import { noteToMidi } from "../helpers/notes.mjs";

const REGIONS = UPRIGHT_PRESET.groups[0].regions;

test("every playable note has a sampled region", () => {
  const lowest = Math.min(...[...TREBLE_KEYS, ...BASS_KEYS].map(noteToMidi));
  const highest = Math.max(...[...TREBLE_KEYS, ...BASS_KEYS].map(noteToMidi));
  for (let midi = lowest; midi <= highest; midi += 1) {
    assert.ok(
      REGIONS.some(({ keyRange: [low, high] }) => midi >= low && midi <= high),
      `no sample covers MIDI ${midi}`,
    );
  }
});

test("sample regions do not overlap", () => {
  const sorted = [...REGIONS].sort((a, b) => a.keyRange[0] - b.keyRange[0]);
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(
      sorted[index].keyRange[0] > sorted[index - 1].keyRange[1],
      `regions overlap: ${sorted[index - 1].sample} and ${sorted[index].sample}`,
    );
  }
});

test("each region is pitched to a root note inside its own range", () => {
  for (const region of REGIONS) {
    const [low, high] = region.keyRange;
    assert.ok(region.pitch >= low && region.pitch <= high, `${region.sample} pitch ${region.pitch} outside [${low}, ${high}]`);
    if ("detune" in region) {
      assert.ok(Math.abs(region.detune) <= 50, `${region.sample} detune ${region.detune} exceeds a quarter tone`);
    }
  }
});

test("preset points at the documented CC0 sample mirror", () => {
  assert.equal(UPRIGHT_PRESET.samples.baseUrl, SAMPLE_LIBRARY_URL);
  assert.equal(new URL(SAMPLE_LIBRARY_URL).hostname, "smpldsnds.github.io");
  assert.deepEqual(UPRIGHT_PRESET.samples.formats, ["ogg", "m4a"]);
});
