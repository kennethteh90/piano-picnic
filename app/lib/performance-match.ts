import { beatDurationSeconds, expectedOnsetSeconds, type SheetScore } from "./sheet-score";
import { midiMatchesExpected, noteToMidi } from "./note-pitch";

export type DetectedNoteEvent = {
  timeSec: number;
  midi: number;
};

export type NoteMatchResult = {
  index: number;
  expected: string;
  expectedTimeSec: number;
  detectedMidi: number | null;
  detectedTimeSec: number | null;
  pitchOk: boolean;
  timingOk: boolean;
  ok: boolean;
};

export type PracticeGrade = "pass" | "partial" | "fail";

export type MatchOptions = {
  /** Max cents off for a note to count as correct pitch. */
  centsTolerance?: number;
  /** How early/late a note may be vs expected beat (fraction of one beat). */
  timingSlackBeats?: number;
};

export const DEFAULT_MATCH_OPTIONS: Required<MatchOptions> = {
  centsTolerance: 50,
  timingSlackBeats: 0.85,
};

export function matchPerformanceToScore(
  score: SheetScore,
  detected: DetectedNoteEvent[],
  options: MatchOptions = {},
): NoteMatchResult[] {
  const opts = { ...DEFAULT_MATCH_OPTIONS, ...options };
  const beatSec = beatDurationSeconds(score);
  const slackSec = opts.timingSlackBeats * beatSec;
  const sorted = [...detected].sort((a, b) => a.timeSec - b.timeSec);
  let detIndex = 0;

  return score.notes.map((note, index) => {
    const expectedTimeSec = expectedOnsetSeconds(score, note.beat);
    let best: DetectedNoteEvent | null = null;
    let bestDist = Infinity;

    while (detIndex < sorted.length) {
      const candidate = sorted[detIndex];
      const dist = Math.abs(candidate.timeSec - expectedTimeSec);
      if (candidate.timeSec < expectedTimeSec - slackSec) {
        detIndex += 1;
        continue;
      }
      if (candidate.timeSec > expectedTimeSec + slackSec) break;
      if (dist < bestDist) {
        bestDist = dist;
        best = candidate;
      }
      detIndex += 1;
      break;
    }

    const pitchOk = best ? midiMatchesExpected(best.midi, note.name, opts.centsTolerance) : false;
    const timingOk = best ? Math.abs(best.timeSec - expectedTimeSec) <= slackSec : false;
    return {
      index,
      expected: note.name,
      expectedTimeSec,
      detectedMidi: best?.midi ?? null,
      detectedTimeSec: best?.timeSec ?? null,
      pitchOk,
      timingOk,
      ok: pitchOk && timingOk,
    };
  });
}

export function gradePractice(results: NoteMatchResult[]): PracticeGrade {
  if (results.length === 0) return "fail";
  const okCount = results.filter((r) => r.ok).length;
  if (okCount === results.length) return "pass";
  if (okCount >= Math.ceil(results.length / 2)) return "partial";
  return "fail";
}

export function practiceSummary(results: NoteMatchResult[]): { correct: number; total: number; missed: string[] } {
  const correct = results.filter((r) => r.ok).length;
  const missed = results.filter((r) => !r.ok).map((r) => r.expected);
  return { correct, total: results.length, missed };
}

/** Merge adjacent same-pitch detections (keeps first onset). */
export function dedupeDetectedNotes(events: DetectedNoteEvent[], samePitchCents = 40): DetectedNoteEvent[] {
  const out: DetectedNoteEvent[] = [];
  for (const ev of events) {
    const prev = out.at(-1);
    if (prev && Math.abs(prev.midi - ev.midi) * 100 <= samePitchCents && ev.timeSec - prev.timeSec < 0.25) continue;
    out.push(ev);
  }
  return out;
}

export function expectedMidis(score: SheetScore): number[] {
  return score.notes.map((n) => noteToMidi(n.name));
}
