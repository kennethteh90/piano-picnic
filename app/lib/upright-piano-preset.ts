// Upright piano sampled instrument for smplr. The samples come from the CC0
// Versilian Community Sample Library ("Upright Piano, Yamaha", by Versilian
// Studios), served as ogg/m4a from smpldsnds' GitHub Pages mirror.
import type { SmplrPreset } from "smplr";

export const SAMPLE_LIBRARY_URL =
  "https://smpldsnds.github.io/sgossner-vcsl/Chordophones/Zithers/";

export const UPRIGHT_PRESET: SmplrPreset = {
  samples: {
    baseUrl: SAMPLE_LIBRARY_URL,
    formats: ["ogg", "m4a"],
  },
  defaults: { ampRelease: 0.55 },
  groups: [{
    regions: [
      { sample: "Upright Piano, Yamaha/Sustains/Upright1_Sus_C2_vl2_rr1", keyRange: [46, 51], pitch: 48, detune: -1, volume: 9.89 },
      { sample: "Upright Piano, Yamaha/Sustains/Upright1_Sus_G2_vl2_rr1", keyRange: [52, 57], pitch: 55, detune: -5, volume: 5.48 },
      { sample: "Upright Piano, Yamaha/Sustains/Upright1_Sus_C3_vl2_rr1", keyRange: [58, 63], pitch: 60, detune: -2, volume: 9.16 },
      { sample: "Upright Piano, Yamaha/Sustains/Upright1_Sus_G3_vl2_rr1", keyRange: [64, 69], pitch: 67, detune: -4, volume: 13.53 },
      { sample: "Upright Piano, Yamaha/Sustains/Upright1_Sus_C4_vl2_rr1", keyRange: [70, 75], pitch: 72, detune: -3, volume: 6.95 },
      { sample: "Upright Piano, Yamaha/Sustains/Upright1_Sus_G4_vl2_rr1", keyRange: [76, 81], pitch: 79, volume: 4.02 },
    ],
  }],
};
