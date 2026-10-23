import type { ScannedEvent, ScannedPitch } from "./sheet-recognition.ts";

export const STACCATO_DURATION_RATIO = 0.38;
export const SLUR_DURATION_RATIO = 0.98;
export const DEFAULT_DURATION_RATIO = 0.94;

export type NoteSounding = {
  note: string;
  at: number;
  duration: number;
};

export function eventNotes(event: ScannedEvent) {
  return [...event.treble, ...event.bass].map((pitch) => pitch.note);
}

export function holdBeatsForPitch(events: ScannedEvent[], startIndex: number, note: string) {
  let beats = 0;
  for (let index = startIndex; index < events.length; index += 1) {
    const match = [...events[index].treble, ...events[index].bass].find((pitch) => pitch.note === note);
    if (!match) break;
    if (index > startIndex && !match.tiedFromPrevious) break;
    beats += 1;
    if (!match.tiedToNext) break;
  }
  return beats;
}

export function slurredBeatSpan(events: ScannedEvent[], startIndex: number, startPitch: ScannedPitch) {
  if (!startPitch.slurredToNext) return 1;
  let span = 1;
  let index = startIndex;
  let pitch: ScannedPitch | undefined = startPitch;
  while (index < events.length - 1 && pitch?.slurredToNext) {
    const incoming = [...events[index + 1].treble, ...events[index + 1].bass].find((entry) => entry.slurredFromPrevious);
    if (!incoming) break;
    span += 1;
    index += 1;
    pitch = incoming;
  }
  return span;
}

export function scoreNoteSchedule(events: ScannedEvent[], beatSeconds = 0.58): NoteSounding[] {
  const schedule: NoteSounding[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const at = index * beatSeconds;
    for (const pitch of [...events[index].treble, ...events[index].bass]) {
      if (pitch.tiedFromPrevious) continue;
      let duration: number;
      if (pitch.staccato) {
        duration = beatSeconds * STACCATO_DURATION_RATIO;
      } else if (pitch.slurredToNext) {
        duration = beatSeconds * slurredBeatSpan(events, index, pitch) * SLUR_DURATION_RATIO;
      } else {
        const holdBeats = holdBeatsForPitch(events, index, pitch.note);
        duration = beatSeconds * holdBeats * DEFAULT_DURATION_RATIO;
      }
      schedule.push({ note: pitch.note, at, duration });
    }
  }
  return schedule;
}

export function scoreLengthSecondsFromNotes(schedule: NoteSounding[]) {
  if (schedule.length === 0) return 0;
  return Math.max(...schedule.map((entry) => entry.at + entry.duration));
}
