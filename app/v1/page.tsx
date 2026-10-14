"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sampler } from "smplr";
import {
  DIFFICULTIES,
  DIFFICULTY_RULES,
  afterCorrectRound,
  difficultySummary,
  questionIndex,
  showsPianoLabels,
  showsQuestionNames,
  type Difficulty,
  type GameMode,
} from "../lib/difficulty";
import { hintView } from "../lib/hints";
import {
  BASS_KEYS,
  CHALLENGE_CHORDS,
  CHORDS,
  NOTE_ROUNDS,
  SOLFEGE,
  TREBLE_KEYS,
  getBlackKeys,
  gradeAnswer,
  noteLetter,
  prettyNotes,
  shuffledIndices,
  type Chord,
} from "../lib/music-theory";
import { matchShortcut, shortcutApplies, shortcutHelp, type ShortcutId } from "../lib/shortcuts";
import { ledgerOffsets, staffPositions } from "../lib/staff-geometry";
import { UPRIGHT_PRESET } from "../lib/upright-piano-preset";

type LearnChordKind = "home" | "companion";
type Feedback = "idle" | "correct" | "incomplete" | "incorrect";

function Staff({ notes, hidden = false, clef = "treble" }: { notes: string[]; hidden?: boolean; clef?: "treble" | "bass" }) {
  const positions = staffPositions(clef);

  // Yamaha-style chord notation stacks noteheads on one vertical stem. Within
  // a cluster of adjacent staff steps, every other lower note moves left so
  // the overlapping noteheads remain readable.
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

  return (
    <div className={`staff ${hidden ? "staff--hidden" : ""}`} aria-label={hidden ? "Listen for the chord" : `Music notes: ${notes.join(", ")}`}>
      <span className={`clef clef--${clef}`} aria-hidden="true">{clef === "treble" ? "𝄞" : "𝄢"}</span>
      <div className="staff-lines" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((line) => <i key={line} />)}
      </div>
      {!hidden && notes.map((note) => (
        <span
          className={`note-head ${isChord || (positions[note] ?? 0) >= 95 ? "note-head--down" : ""} ${isChord && note !== stemNote ? "note-head--stemless" : ""}`}
          key={note}
          style={{ bottom: positions[note] ?? 40, left: isChord && shiftedNotes.has(note) ? "calc(54% - 16px)" : "54%" }}
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

function Piano({ selected, glowing, labeled, onPress, register }: { selected: string[]; glowing: string[]; labeled: boolean; onPress: (note: string) => void; register: "treble" | "bass" }) {
  const keys = register === "treble" ? TREBLE_KEYS : BASS_KEYS;
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
      <div className="keyboard-caption"><span>Lower</span><span>Tap the piano keys to answer</span><span>Higher</span></div>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<GameMode>("learn");
  const [difficulty, setDifficulty] = useState<Difficulty>("seedling");
  const [learnIndex, setLearnIndex] = useState(0);
  const [learnChordKind, setLearnChordKind] = useState<LearnChordKind>("home");
  const [learnPractice, setLearnPractice] = useState(false);
  const [round, setRound] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [noteOrder, setNoteOrder] = useState(() => NOTE_ROUNDS.map((_, index) => index));
  const [chordOrder, setChordOrder] = useState(() => CHALLENGE_CHORDS.map((_, index) => index));
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [stars, setStars] = useState(0);
  const [muted, setMuted] = useState(false);
  const [soundStatus, setSoundStatus] = useState<"sleeping" | "loading" | "ready" | "error">("sleeping");
  const audioRef = useRef<AudioContext | null>(null);
  const pianoRef = useRef<ReturnType<typeof Sampler> | null>(null);
  const pianoPromiseRef = useRef<Promise<ReturnType<typeof Sampler>> | null>(null);
  const gradingRef = useRef(false);

  const currentFamily = CHORDS[learnIndex % CHORDS.length];
  const noteIndex = questionIndex(difficulty, round, noteOrder, NOTE_ROUNDS.length);
  const chordIndex = questionIndex(difficulty, round, chordOrder, CHALLENGE_CHORDS.length);
  const currentChord: Chord = mode === "learn"
    ? learnChordKind === "home" ? currentFamily : currentFamily.companion
    : CHALLENGE_CHORDS[chordIndex];
  const currentNote = NOTE_ROUNDS[noteIndex];
  const answer = useMemo(() => (mode === "note" ? [currentNote] : currentChord.notes), [currentChord.notes, currentNote, mode]);
  const maxSelection = mode === "note" ? 1 : 3;
  const isPractice = mode !== "learn" || learnPractice;
  const showQuestionLabels = showsQuestionNames(difficulty, mode, isPractice);
  const hint = hintView({
    mode,
    difficulty,
    answer,
    selected,
    hintsUsed: hintCount,
    chord: { quality: currentChord.quality, root: currentChord.root },
  });
  const staffNotes = mode === "note"
    ? [currentNote]
    : mode === "hear"
      ? (feedback === "correct" ? currentChord.notes : hint.staffNotes)
      : currentChord.notes;
  const staffHidden = mode === "hear" && staffNotes.length === 0;
  const glowing = !isPractice ? currentChord.notes : feedback === "correct" ? [] : hint.glowNotes;

  const getPiano = useCallback(async () => {
    if (pianoRef.current) return pianoRef.current;
    if (pianoPromiseRef.current) return pianoPromiseRef.current;

    pianoPromiseRef.current = (async () => {
      setSoundStatus("loading");
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const context = audioRef.current ?? new AudioContextClass();
      audioRef.current = context;
      if (context.state === "suspended") await context.resume();

      const piano = Sampler(context, { preset: UPRIGHT_PRESET, volume: 72 });
      await piano.ready;
      pianoRef.current = piano;
      setSoundStatus("ready");
      return piano;
    })().catch((error) => {
      console.error("Could not load the upright piano samples", error);
      pianoPromiseRef.current = null;
      setSoundStatus("error");
      throw error;
    });

    return pianoPromiseRef.current;
  }, []);

  const playNotes = useCallback(async (notes: string[], rolled = false) => {
    if (muted) return;
    try {
      const piano = await getPiano();
      const context = audioRef.current;
      if (!context) return;
      if (context.state === "suspended") await context.resume();
      notes.forEach((note, index) => piano.start({
        note,
        time: context.currentTime + 0.02 + (rolled ? index * 0.12 : 0),
        duration: 2.25,
        velocity: rolled ? 78 + index * 3 : 84,
      }));
    } catch {
      // The visible sound status explains that the samples could not load.
    }
  }, [getPiano, muted]);

  const resetAnswer = useCallback(() => {
    gradingRef.current = false;
    setSelected([]);
    setFeedback("idle");
    setHintCount(0);
  }, []);

  const switchMode = (nextMode: GameMode) => {
    setMode(nextMode);
    setLearnPractice(false);
    setLearnChordKind("home");
    setRound(0);
    resetAnswer();
    if (nextMode !== "learn" && DIFFICULTY_RULES[difficulty].order === "shuffled") {
      if (nextMode === "note") setNoteOrder(shuffledIndices(NOTE_ROUNDS.length));
      else setChordOrder(shuffledIndices(CHALLENGE_CHORDS.length));
    }
  };

  const changeDifficulty = (nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    setRound(0);
    resetAnswer();
    if (DIFFICULTY_RULES[nextDifficulty].order === "shuffled") {
      setNoteOrder(shuffledIndices(NOTE_ROUNDS.length));
      setChordOrder(shuffledIndices(CHALLENGE_CHORDS.length));
    }
  };

  const handleKey = (note: string) => {
    if (feedback === "correct") return;
    void playNotes([note]);
    setFeedback("idle");
    if (selected.includes(note)) {
      setSelected(selected.filter((key) => key !== note));
      return;
    }
    if (maxSelection === 1) setSelected([note]);
    else if (selected.length < maxSelection) setSelected([...selected, note]);
  };

  const checkAnswer = useCallback(() => {
    if (gradingRef.current) return;
    const result = gradeAnswer(selected, answer);
    if (result === "correct") {
      gradingRef.current = true;
      setFeedback("correct");
      setStars((value) => value + 1);
      void playNotes(answer, false);
      return;
    }
    setFeedback(result);
  }, [answer, playNotes, selected]);

  const revealHint = useCallback(() => {
    if (feedback === "correct" || hintCount >= hint.budget) return;
    setHintCount((value) => Math.min(hint.budget, value + 1));
    setFeedback("idle");
  }, [feedback, hint.budget, hintCount]);

  const nextRound = useCallback(() => {
    resetAnswer();
    if (mode === "learn") {
      setLearnPractice(false);
      if (learnChordKind === "home") setLearnChordKind("companion");
      else {
        setLearnChordKind("home");
        setLearnIndex((value) => (value + 1) % CHORDS.length);
      }
      return;
    }
    const length = mode === "note" ? NOTE_ROUNDS.length : CHALLENGE_CHORDS.length;
    const order = mode === "note" ? noteOrder : chordOrder;
    const next = afterCorrectRound({ difficulty, round, length, order });
    setRound(next.round);
    if (mode === "note") setNoteOrder(next.order);
    else setChordOrder(next.order);
  }, [chordOrder, difficulty, learnChordKind, mode, noteOrder, resetAnswer, round]);

  const previousLearningChord = () => {
    resetAnswer();
    setLearnPractice(false);
    if (learnChordKind === "companion") setLearnChordKind("home");
    else {
      setLearnChordKind("companion");
      setLearnIndex((value) => (value + CHORDS.length - 1) % CHORDS.length);
    }
  };

  const selectLearningChord = (kind: LearnChordKind) => {
    setLearnChordKind(kind);
    resetAnswer();
    setLearnPractice(false);
  };

  const runShortcut = useCallback((id: ShortcutId) => {
    if (!shortcutApplies(id, mode, isPractice)) return false;
    const notes = isPractice ? answer : currentChord.notes;
    if (id === "hearChord") {
      void playNotes(notes, false);
      return true;
    }
    if (id === "hearNotes") {
      void playNotes(notes, true);
      return true;
    }
    if (id === "hint") {
      if (feedback === "correct" || hintCount >= hint.budget) return false;
      revealHint();
      return true;
    }
    if (feedback === "correct") nextRound();
    else checkAnswer();
    return true;
  }, [answer, checkAnswer, currentChord.notes, feedback, hint.budget, hintCount, isPractice, mode, nextRound, playNotes, revealHint]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      const shortcut = matchShortcut(event);
      if (!shortcut) return;
      if (!runShortcut(shortcut)) return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runShortcut]);

  const hearTitle = mode === "note" ? "Hear note" : "Hear chord";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Piano Picnic home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Piano Picnic</span>
        </a>
        <div className="top-actions">
          <div className="star-score" aria-label={`${stars} stars earned`}><span>★</span>{stars}</div>
          <button
            className={`sound-button sound-button--${soundStatus}`}
            onClick={() => {
              if (muted || soundStatus === "error") {
                setMuted(false);
                void getPiano();
              } else setMuted(true);
            }}
            aria-label={muted ? "Turn upright piano sound on" : "Turn sound off"}
          >
            {soundStatus === "loading" ? "Loading piano" : soundStatus === "error" ? "Try sound" : muted ? "Sound off" : "Upright piano"}
            <span aria-hidden="true">{soundStatus === "loading" ? "…" : muted ? "×" : "♪"}</span>
          </button>
        </div>
      </header>

      <section className="game" id="top">
        <nav className="mode-tabs" aria-label="Choose a game">
          <button className={mode === "learn" ? "active" : ""} aria-pressed={mode === "learn"} onClick={() => switchMode("learn")}><span>01</span> Learn</button>
          <button className={mode === "note" ? "active" : ""} aria-pressed={mode === "note"} onClick={() => switchMode("note")}><span>02</span> Find a note</button>
          <button className={mode === "see" ? "active" : ""} aria-pressed={mode === "see"} onClick={() => switchMode("see")}><span>03</span> See a chord</button>
          <button className={mode === "hear" ? "active" : ""} aria-pressed={mode === "hear"} onClick={() => switchMode("hear")}><span>04</span> Hear a chord</button>
        </nav>

        <p className="shortcut-legend">
          <span>While you answer</span>
          {shortcutHelp(mode).map((shortcut) => (
            <kbd key={shortcut.id}>{shortcut.label} {shortcut.title}</kbd>
          ))}
        </p>

        <div className="difficulty-bar">
          <div>
            <span className="difficulty-label">Challenge level</span>
            <strong>{difficultySummary(difficulty, mode)}</strong>
          </div>
          <div className="difficulty-options" role="group" aria-label="Choose a difficulty level">
            {DIFFICULTIES.map((level) => (
              <button
                key={level}
                className={difficulty === level ? "active" : ""}
                aria-pressed={difficulty === level}
                title={DIFFICULTY_RULES[level].summary}
                onClick={() => changeDifficulty(level)}
              >
                <span>{DIFFICULTY_RULES[level].mark}</span> {DIFFICULTY_RULES[level].label}
              </button>
            ))}
          </div>
        </div>

        <div className="lesson-grid">
          <div className="lesson-copy">
            <p className="eyebrow">
              {mode === "learn" && `Key family ${learnIndex + 1} of ${CHORDS.length} · ${learnChordKind === "home" ? "Home chord" : "Companion chord"}`}
              {mode === "note" && "Note detective"}
              {mode === "see" && "Chord puzzle"}
              {mode === "hear" && "Listening ears"}
            </p>
            <h1>
              {mode === "learn" && !learnPractice && <>Meet <em style={{ color: currentChord.color }}>{currentChord.name}</em></>}
              {mode === "learn" && learnPractice && showQuestionLabels && <>Build <em style={{ color: currentChord.color }}>{currentChord.name}</em></>}
              {mode === "learn" && learnPractice && !showQuestionLabels && <>Build <em>this chord.</em></>}
              {mode === "note" && <>Which note is <em>written?</em></>}
              {mode === "see" && <>Build the chord <em>you see.</em></>}
              {mode === "hear" && <>Build the chord <em>you hear.</em></>}
            </h1>
            <p className="lesson-description">
              {mode === "learn" && !learnPractice && currentChord.story}
              {mode === "learn" && learnPractice && showQuestionLabels && `Tap ${prettyNotes(currentChord.notes).join(", ")} on the piano, then check your chord.`}
              {mode === "learn" && learnPractice && !showQuestionLabels && "Build the chord on the piano, then check it. A hint can help."}
              {mode === "note" && "Look at the note on the music staff. Tap its matching piano key."}
              {mode === "see" && "Look at all three notes. Tap the matching piano keys to build the chord."}
              {mode === "hear" && "Press play, listen closely, then tap the three notes you heard."}
            </p>

            {mode === "learn" && !learnPractice && (
              <div className="chord-pair" role="group" aria-label={`${currentFamily.name} home and companion chords`}>
                <button className={learnChordKind === "home" ? "active" : ""} aria-pressed={learnChordKind === "home"} onClick={() => selectLearningChord("home")}>
                  <small>Home chord</small>
                  <strong>{currentFamily.name}</strong>
                  <span>{prettyNotes(currentFamily.notes).join(" · ")}</span>
                </button>
                <i aria-hidden="true">↔</i>
                <button className={learnChordKind === "companion" ? "active" : ""} aria-pressed={learnChordKind === "companion"} onClick={() => selectLearningChord("companion")}>
                  <small>Companion</small>
                  <strong>{currentFamily.companion.name}</strong>
                  <span>{prettyNotes(currentFamily.companion.notes).join(" · ")}</span>
                </button>
              </div>
            )}

            {mode === "learn" && !learnPractice && (
              <div className="note-recipe">
                {prettyNotes(currentChord.notes).map((note, index) => <span key={note}><b>{index + 1}</b>{note}</span>)}
              </div>
            )}

            {mode === "learn" && !learnPractice && (
              <div className="lesson-actions">
                <button className="primary-action" onClick={() => void playNotes(currentChord.notes, false)} aria-keyshortcuts="C"><span aria-hidden="true">▶</span> Play whole chord <kbd>C</kbd></button>
                <button className="text-action" onClick={() => void playNotes(currentChord.notes, true)} aria-keyshortcuts="N">Notes one by one <kbd>N</kbd></button>
                <button className="text-action" onClick={() => { setLearnPractice(true); setSelected([]); setFeedback("idle"); setHintCount(0); }}>Let me build it <span>→</span></button>
              </div>
            )}
          </div>

          <div className="music-card" style={{ "--accent": currentChord.color } as React.CSSProperties}>
            <div className="music-card-top">
              <span>
                {mode === "learn" && (showQuestionLabels ? currentChord.name : "Your turn")}
                {mode === "note" && (showQuestionLabels ? `${noteLetter(currentNote)} · ${SOLFEGE[noteLetter(currentNote)]}` : "One mystery note")}
                {mode === "see" && (showQuestionLabels ? currentChord.name : "Mystery chord")}
                {mode === "hear" && (feedback === "correct" ? currentChord.name : "Listen")}
              </span>
              <small>
                {mode === "note" && "Treble clef"}
                {mode !== "note" && mode !== "hear" && "Bass clef"}
                {mode === "hear" && (feedback === "correct" ? "Bass clef" : hint.hintsUsed > 0 ? `Hint ${hint.hintsUsed}/${hint.budget}` : "Listen")}
              </small>
            </div>
            <Staff notes={staffNotes} hidden={staffHidden} clef={mode === "note" ? "treble" : "bass"} />
            {mode !== "note" && mode !== "hear" && <p className={`chord-formula ${!showQuestionLabels ? "is-hidden-hint" : ""}`}>{showQuestionLabels ? prettyNotes(currentChord.notes).join("  +  ") : "Read the three notes—no name clues this time"}</p>}
            {mode === "note" && <p className={`chord-formula ${!showQuestionLabels ? "is-hidden-hint" : ""}`}>{showQuestionLabels ? `${noteLetter(currentNote)} is ${SOLFEGE[noteLetter(currentNote)]}` : "Read the note—no name clue this time"}</p>}
            {mode === "hear" && (
              <p className="chord-formula">
                {feedback === "correct"
                  ? prettyNotes(currentChord.notes).join("  +  ")
                  : hint.hintsUsed > 0 ? `${hint.hintsUsed} of ${hint.budget} hints used` : "No peeking—use your listening ears!"}
              </p>
            )}
            {isPractice && feedback !== "correct" && hint.message && <p className="hint-banner" role="status">{hint.message}</p>}
          </div>
        </div>

        <div className="answer-zone">
          <div className="answer-status" aria-live="polite">
            {feedback === "idle" && <span>{isPractice ? `${selected.length} of ${answer.length} selected` : "The glowing keys make this chord"}</span>}
            {feedback === "incomplete" && <span className="try-again">Choose every note, then check.</span>}
            {feedback === "incorrect" && <span className="try-again">{mode === "hear" ? "Not quite. Listen again, or ask for a hint." : "Not quite. Look again, or ask for a hint."}</span>}
            {feedback === "correct" && <span className="correct">★ You found it! Beautiful playing.</span>}
          </div>
          <div className="answer-actions">
            {isPractice && (
              <>
                <button className="answer-tool" onClick={() => void playNotes(answer, false)} aria-label={hearTitle} aria-keyshortcuts="C">
                  <span aria-hidden="true">▶</span> {hearTitle} <kbd>C</kbd>
                </button>
                {mode !== "note" && (
                  <button className="answer-tool" onClick={() => void playNotes(answer, true)} aria-label="Hear notes" aria-keyshortcuts="N">
                    <span aria-hidden="true">♪</span> Hear notes <kbd>N</kbd>
                  </button>
                )}
                <button
                  className="answer-tool hint-button"
                  onClick={revealHint}
                  disabled={feedback === "correct" || hint.hintsUsed >= hint.budget}
                  aria-keyshortcuts="H"
                  aria-label={`Hint. ${hint.hintsUsed} of ${hint.budget} used`}
                >
                  <span aria-hidden="true">◆</span> Hint {hint.hintsUsed}/{hint.budget} <kbd>H</kbd>
                </button>
                <button className={`check-button ${feedback === "correct" ? "next" : ""}`} onClick={feedback === "correct" ? nextRound : checkAnswer} aria-keyshortcuts="Enter">
                  {feedback === "correct" ? "Next" : mode === "note" ? "Check note" : "Check chord"} <kbd>Enter</kbd>
                </button>
              </>
            )}
            {!isPractice && (
              <div className="learn-pager">
                <button onClick={previousLearningChord} aria-label="Previous chord">←</button>
                <span>{CHORDS.map((_, index) => <i className={index === learnIndex ? "active" : ""} key={index} />)}</span>
                <button onClick={nextRound} aria-label="Next chord">→</button>
              </div>
            )}
          </div>
        </div>

        <Piano selected={selected} glowing={glowing} labeled={showsPianoLabels(difficulty)} onPress={handleKey} register={mode === "note" ? "treble" : "bass"} />
      </section>

      <footer>
        <p>Made for curious little musicians</p>
        <span>Listen • Look • Play</span>
      </footer>
    </main>
  );
}
