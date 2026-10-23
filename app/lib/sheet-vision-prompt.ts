export const SHEET_VISION_SYSTEM = `You read simple piano grand-staff images. Return JSON only, no markdown.
Schema: { "events": [ { "treble": [{ "note": "E4", "staccato"?: true, "tiedToNext"?: true, "slurredToNext"?: true, ... }], "bass": [...] } ] }
Notes are spelled like C4, F#4, Bb3. Order events left-to-right in time. Chords share one event with multiple pitches in treble or bass.`;

export const SHEET_VISION_USER = "List note events on this grand staff for playback. Include common accidentals when visible.";
