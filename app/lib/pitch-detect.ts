import { frequencyToMidi } from "./note-pitch";

/** YIN-style pitch estimate on a mono buffer. Returns Hz or NaN. */
export function detectPitchYin(samples: Float32Array, sampleRate: number, minHz = 80, maxHz = 1200): number {
  if (samples.length < 2 || sampleRate <= 0) return NaN;

  let rms = 0;
  for (let i = 0; i < samples.length; i += 1) rms += samples[i] * samples[i];
  rms = Math.sqrt(rms / samples.length);
  if (rms < 0.008) return NaN;

  const minTau = Math.floor(sampleRate / maxHz);
  const maxTau = Math.min(Math.floor(sampleRate / minHz), samples.length - 1);
  if (maxTau <= minTau) return NaN;

  const yin = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau += 1) {
    yin[tau] = 0;
    for (let i = 0; i < samples.length - tau; i += 1) {
      const delta = samples[i] - samples[i + tau];
      yin[tau] += delta * delta;
    }
  }

  let runningSum = 0;
  yin[0] = 1;
  for (let tau = 1; tau <= maxTau; tau += 1) {
    runningSum += yin[tau];
    yin[tau] = runningSum === 0 ? 1 : (yin[tau] * tau) / runningSum;
  }

  const threshold = 0.15;
  let bestTau = -1;
  for (let tau = minTau; tau <= maxTau; tau += 1) {
    if (yin[tau] < threshold) {
      while (tau + 1 <= maxTau && yin[tau + 1] < yin[tau]) tau += 1;
      bestTau = tau;
      break;
    }
  }
  if (bestTau < 0) {
    let minVal = Infinity;
    for (let tau = minTau; tau <= maxTau; tau += 1) {
      if (yin[tau] < minVal) {
        minVal = yin[tau];
        bestTau = tau;
      }
    }
  }

  if (bestTau <= 0) return NaN;

  const x0 = bestTau > 0 ? bestTau - 1 : bestTau;
  const x2 = bestTau + 1 < yin.length ? bestTau + 1 : bestTau;
  const s0 = yin[x0];
  const s1 = yin[bestTau];
  const s2 = yin[x2];
  const refined = s0 + s2 - 2 * s1 === 0 ? bestTau : bestTau + (s0 - s2) / (2 * (s0 - 2 * s1 + s2));
  return sampleRate / refined;
}

export function detectSegmentMidi(samples: Float32Array, sampleRate: number): number {
  return frequencyToMidi(detectPitchYin(samples, sampleRate));
}

/** Simple energy-based onset times (seconds) in a buffer. */
export function detectOnsets(
  samples: Float32Array,
  sampleRate: number,
  options: { frameSize?: number; hopSize?: number; threshold?: number; minGapSec?: number } = {},
): number[] {
  const frameSize = options.frameSize ?? 2048;
  const hopSize = options.hopSize ?? 512;
  const threshold = options.threshold ?? 0.02;
  const minGapSec = options.minGapSec ?? 0.12;

  const onsets: number[] = [];
  let prevEnergy = 0;
  let lastOnset = -Infinity;

  for (let start = 0; start + frameSize < samples.length; start += hopSize) {
    let energy = 0;
    for (let i = start; i < start + frameSize; i += 1) energy += samples[i] * samples[i];
    energy = Math.sqrt(energy / frameSize);
    const t = start / sampleRate;
    if (energy > threshold && energy > prevEnergy * 1.35 && t - lastOnset >= minGapSec) {
      onsets.push(t);
      lastOnset = t;
    }
    prevEnergy = energy;
  }
  return onsets;
}
