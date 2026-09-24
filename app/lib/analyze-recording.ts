import { detectOnsets, detectSegmentMidi } from "./pitch-detect";
import { dedupeDetectedNotes, type DetectedNoteEvent } from "./performance-match";
import type { SheetScore } from "./sheet-score";

const ANALYSIS_WINDOW_SEC = 0.35;

/** Turn a recorded mono buffer into ordered note events for scoring. */
export function analyzeRecording(samples: Float32Array, sampleRate: number, score: SheetScore): DetectedNoteEvent[] {
  const onsets = detectOnsets(samples, sampleRate, {
    minGapSec: Math.max(0.1, (60 / score.bpm) * 0.45),
  });

  const events: DetectedNoteEvent[] = [];
  for (const timeSec of onsets) {
    const start = Math.max(0, Math.floor((timeSec - 0.02) * sampleRate));
    const end = Math.min(samples.length, Math.floor((timeSec + ANALYSIS_WINDOW_SEC) * sampleRate));
    const slice = samples.subarray(start, end);
    const midi = detectSegmentMidi(slice, sampleRate);
    if (!Number.isFinite(midi)) continue;
    events.push({ timeSec, midi });
  }

  return dedupeDetectedNotes(events);
}

/** Decode WebM/Opus blob to mono Float32 (browser). */
export async function decodeAudioBlobToMono(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioContextClass();
  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    const channel = audioBuffer.numberOfChannels > 0 ? audioBuffer.getChannelData(0) : new Float32Array(0);
    const samples = new Float32Array(channel.length);
    samples.set(channel);
    if (audioBuffer.numberOfChannels > 1) {
      const ch1 = audioBuffer.getChannelData(1);
      for (let i = 0; i < samples.length; i += 1) samples[i] = (samples[i] + ch1[i]) / 2;
    }
    return { samples, sampleRate: audioBuffer.sampleRate };
  } finally {
    await context.close();
  }
}
