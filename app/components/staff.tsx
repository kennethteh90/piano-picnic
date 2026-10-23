import {
  EMPTY_SIGNATURE,
  noteAccidental,
  signatureLetters,
  type KeySignature,
} from "../lib/music-theory";
import { NOTEHEAD_CENTER_OFFSET, ledgerCenters, signaturePitch, staffPositions } from "../lib/staff-geometry";

export function Staff({
  notes,
  hidden = false,
  clef = "treble",
  signature = EMPTY_SIGNATURE,
}: {
  notes: string[];
  hidden?: boolean;
  clef?: "treble" | "bass";
  signature?: KeySignature;
}) {
  const positions = staffPositions(clef);

  const stackedNotes = [...notes].sort((a, b) => (positions[a] ?? 0) - (positions[b] ?? 0));
  const shiftedNotes = new Set<string>();
  let runStart = 0;
  for (let index = 1; index <= stackedNotes.length; index += 1) {
    const continuesRun = index < stackedNotes.length
      && (positions[stackedNotes[index]] ?? 0) - (positions[stackedNotes[index - 1]] ?? 0) === 8;
    if (continuesRun) continue;
    for (let shiftedIndex = index - 2; shiftedIndex >= runStart; shiftedIndex -= 2) shiftedNotes.add(stackedNotes[shiftedIndex]);
    runStart = index;
  }
  const isChord = notes.length > 1;
  const stemNote = stackedNotes.at(-1);
  const ledgerClass = shiftedNotes.size > 0 ? "ledger ledger--cluster" : "ledger";

  return (
    <div className={`staff ${hidden ? "staff--hidden" : ""}`} aria-label={hidden ? "Listen for the chord" : `Music notes: ${notes.join(", ")}`}>
      <span className={`clef clef--${clef}`} aria-hidden="true">{clef === "treble" ? "𝄞" : "𝄢"}</span>
      <div className="staff-lines" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((line) => <i key={line} />)}
      </div>
      {!hidden && signatureLetters(signature).map((letter, index) => {
        const pitch = signaturePitch(clef, letter, signature.kind);
        return (
          <span
            className="key-signature"
            key={letter}
            aria-hidden="true"
            style={{
              bottom: (positions[pitch] ?? 80) + NOTEHEAD_CENTER_OFFSET,
              left: `calc(22% + ${index * 16}px)`,
            }}
          >
            {signature.kind === "sharp" ? "♯" : "♭"}
          </span>
        );
      })}
      {!hidden && ledgerCenters(clef, notes).map((center) => (
        <span className={ledgerClass} style={{ bottom: center }} key={center} />
      ))}
      {!hidden && notes.map((note) => {
        const accidental = noteAccidental(note, signature);
        return (
          <span
            className={`note-head ${isChord || (positions[note] ?? 0) >= 95 ? "note-head--down" : ""} ${isChord && note !== stemNote ? "note-head--stemless" : ""}`}
            key={note}
            style={{ bottom: positions[note] ?? 40, left: isChord && shiftedNotes.has(note) ? "calc(54% - 16px)" : "54%" }}
          >
            {accidental && <span className="accidental">{accidental}</span>}
          </span>
        );
      })}
      {hidden && <div className="listen-mark" aria-hidden="true"><span>♪</span><span>?</span></div>}
    </div>
  );
}
