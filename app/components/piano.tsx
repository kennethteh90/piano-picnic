import {
  BASS_KEYS,
  SOLFEGE,
  TREBLE_KEYS,
  getBlackKeys,
  noteLetter,
} from "../lib/music-theory";

export function Piano({
  selected,
  glowing,
  labeled,
  onPress,
  register,
  whiteKeys,
  caption = "Tap the piano keys to answer",
}: {
  selected: string[];
  glowing: string[];
  labeled: boolean;
  onPress: (note: string) => void;
  register: "treble" | "bass";
  whiteKeys?: readonly string[];
  caption?: string;
}) {
  const keys = whiteKeys ?? (register === "treble" ? TREBLE_KEYS : BASS_KEYS);
  const blackKeys = getBlackKeys(register);
  return (
    <div className="piano-shell">
      <div className={`piano ${labeled ? "" : "piano--unlabeled"}`} role="group" aria-label="Piano keyboard">
        {keys.map((note, index) => {
          const letter = noteLetter(note);
          const active = selected.includes(note);
          const lit = glowing.includes(note);
          const blackKey = blackKeys[index];
          return (
            <div className="key-wrap" key={note}>
              <button
                className={`white-key ${active ? "is-selected" : ""} ${lit ? "is-glowing" : ""}`}
                onClick={() => onPress(note)}
                aria-pressed={active}
                aria-label={`${letter}, ${SOLFEGE[letter]}`}
              >
                <span className="solfege">{SOLFEGE[letter]}</span>
                <strong>{letter}</strong>
              </button>
              {blackKey && index < keys.length - 1 && (
                <button
                  className={`black-key ${selected.includes(blackKey.note) ? "is-selected" : ""} ${glowing.includes(blackKey.note) ? "is-glowing" : ""}`}
                  onClick={() => onPress(blackKey.note)}
                  aria-pressed={selected.includes(blackKey.note)}
                  aria-label={`${blackKey.letter}, ${blackKey.solfege}`}
                >
                  <span className="solfege">{blackKey.solfege}</span>
                  <strong>{blackKey.letter}</strong>
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="keyboard-caption"><span>Lower</span><span>{caption}</span><span>Higher</span></div>
    </div>
  );
}
