import { Sampler, Soundfont, SplendidGrandPiano } from "smplr";
import { GRAND_VELOCITY_RANGE, ORGAN_INSTRUMENT, ORGAN_KIT, gameMidiNotes, type PianoTone } from "./piano-tones.ts";
import { UPRIGHT_PRESET } from "./upright-piano-preset.ts";

export type Playable = {
  start: (event: { note: string; time?: number; duration?: number; velocity?: number }) => void;
};

export async function createTone(context: AudioContext, tone: PianoTone): Promise<Playable> {
  if (tone === "grand") {
    const piano = SplendidGrandPiano(context, {
      volume: 84,
      decayTime: 0.45,
      notesToLoad: { notes: gameMidiNotes(), velocityRange: GRAND_VELOCITY_RANGE },
    });
    await piano.ready;
    return piano;
  }
  if (tone === "organ") {
    const organ = Soundfont(context, { instrument: ORGAN_INSTRUMENT, kit: ORGAN_KIT, volume: 72 });
    await organ.ready;
    return organ;
  }
  const upright = Sampler(context, { preset: UPRIGHT_PRESET, volume: 72 });
  await upright.ready;
  return upright;
}
