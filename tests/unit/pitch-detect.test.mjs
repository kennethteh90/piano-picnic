import assert from "node:assert/strict";
import test from "node:test";
import { detectPitchYin } from "../../app/lib/pitch-detect.ts";

function sineBuffer(frequency, sampleRate, durationSec) {
  const length = Math.floor(sampleRate * durationSec);
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    samples[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate) * 0.6;
  }
  return samples;
}

test("detectPitchYin estimates middle C near 261 Hz", () => {
  const sampleRate = 44100;
  const samples = sineBuffer(261.63, sampleRate, 0.4);
  const hz = detectPitchYin(samples, sampleRate);
  assert.ok(Math.abs(hz - 261.63) < 8, `expected ~261 Hz, got ${hz}`);
});
