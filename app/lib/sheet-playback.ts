import type { Sounding } from "./naming.ts";
import type { ScannedEvent } from "./sheet-recognition.ts";

export const SCAN_TEMPO_PRESETS = [
  { id: "slow", label: "Slow", beatSeconds: 0.92 },
  { id: "steady", label: "Steady", beatSeconds: 0.58 },
  { id: "quick", label: "Quick", beatSeconds: 0.36 },
] as const;

export type ScanTempoId = (typeof SCAN_TEMPO_PRESETS)[number]["id"];

export function beatSecondsForTempo(tempo: ScanTempoId) {
  return SCAN_TEMPO_PRESETS.find((preset) => preset.id === tempo)?.beatSeconds ?? 0.58;
}

export function scoreSchedule(events: ScannedEvent[], beatSeconds = 0.58): Sounding[] {
  return events.map((event, index) => ({
    notes: [...event.treble, ...event.bass],
    at: index * beatSeconds,
    duration: beatSeconds * 0.92,
  }));
}

export function scoreLengthSeconds(eventCount: number, beatSeconds = 0.58) {
  if (eventCount <= 0) return 0;
  return (eventCount - 1) * beatSeconds + beatSeconds * 0.92;
}

/** @deprecated Use scoreSchedule for grand-staff chords. */
export function melodySchedule(notes: string[], beatSeconds = 0.58): Sounding[] {
  return notes.map((note, index) => ({
    notes: [note],
    at: index * beatSeconds,
    duration: beatSeconds * 0.92,
  }));
}

/** @deprecated Use scoreLengthSeconds. */
export function melodyLengthSeconds(notes: string[], beatSeconds = 0.58) {
  return scoreLengthSeconds(notes.length, beatSeconds);
}
