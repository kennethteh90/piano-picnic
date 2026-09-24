import { ledgerOffsets, sequenceNoteLeftPercent, staffPositions } from "../lib/staff-geometry";

export function Staff({
  notes,
  hidden = false,
  clef = "treble",
  layout = "chord",
}: {
  notes: string[];
  hidden?: boolean;
  clef?: "treble" | "bass";
  /** Chord games stack noteheads; sheet practice spreads a melody left-to-right. */
  layout?: "chord" | "sequence";
}) {
  const positions = staffPositions(clef);
  const isSequence = layout === "sequence";

  const stackedNotes = [...notes].sort((a, b) => (positions[a] ?? 0) - (positions[b] ?? 0));
  const shiftedNotes = new Set<string>();
  if (!isSequence) {
    let runStart = 0;
    for (let index = 1; index <= stackedNotes.length; index += 1) {
      const continuesRun = index < stackedNotes.length
        && (positions[stackedNotes[index]] ?? 0) - (positions[stackedNotes[index - 1]] ?? 0) === 8;
      if (continuesRun) continue;
      for (let shiftedIndex = index - 2; shiftedIndex >= runStart; shiftedIndex -= 2) shiftedNotes.add(stackedNotes[shiftedIndex]);
      runStart = index;
    }
  }
  const isChord = !isSequence && notes.length > 1;
  const stemNote = stackedNotes.at(-1);

  const noteLeft = (note: string, index: number) => {
    if (isSequence) return `${sequenceNoteLeftPercent(index, notes.length)}%`;
    if (isChord && shiftedNotes.has(note)) return "calc(54% - 16px)";
    return "54%";
  };

  return (
    <div className={`staff ${hidden ? "staff--hidden" : ""}`} aria-label={hidden ? "Listen for the chord" : `Music notes: ${notes.join(", ")}`}>
      <span className={`clef clef--${clef}`} aria-hidden="true">{clef === "treble" ? "𝄞" : "𝄢"}</span>
      <div className="staff-lines" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((line) => <i key={line} />)}
      </div>
      {!hidden && notes.map((note, index) => (
        <span
          className={`note-head ${isChord || (positions[note] ?? 0) >= 95 ? "note-head--down" : ""} ${isChord && note !== stemNote ? "note-head--stemless" : ""}`}
          key={isSequence ? `${index}-${note}` : note}
          style={{ bottom: positions[note] ?? 40, left: noteLeft(note, index) }}
        >
          {ledgerOffsets(clef, note).map((offset) => <span className="ledger" style={{ top: offset }} key={offset} />)}
          {note.includes("#") && <span className="accidental">♯</span>}
          {note.includes("b") && <span className="accidental">♭</span>}
        </span>
      ))}
      {hidden && <div className="listen-mark" aria-hidden="true"><span>♪</span><span>?</span></div>}
    </div>
  );
}
