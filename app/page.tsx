"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Sampler } from "smplr";
import {
  BASS_KEYS,
  CHALLENGE_CHORDS,
  CHORDS,
  NOTE_ROUNDS,
  SOLFEGE,
  TREBLE_KEYS,
  getBlackKeys,
  noteLetter,
  prettyNotes,
  sameNotes,
  shuffledIndices,
  type Chord,
} from "./lib/music-theory";
import { UPRIGHT_PRESET } from "./lib/upright-piano-preset";
import { Staff } from "./components/staff";
import { SheetPracticeView } from "./sheet-practice-view";

type Mode = "learn" | "note" | "see" | "hear" | "sheet";
type Difficulty = "seedling" | "explorer" | "superstar";
type LearnChordKind = "home" | "companion";

function Piano({ selected, glowing, onPress, register }: { selected: string[]; glowing: string[]; onPress: (note: string) => void; register: "treble" | "bass" }) {
  const keys = register === "treble" ? TREBLE_KEYS : BASS_KEYS;
  const blackKeys = getBlackKeys(register);
  return (
    <div className="piano-shell">
      <div className="piano" role="group" aria-label="Piano keyboard">
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
  const [mode, setMode] = useState<Mode>("learn");
  const [difficulty, setDifficulty] = useState<Difficulty>("seedling");
  const [learnIndex, setLearnIndex] = useState(0);
  const [learnChordKind, setLearnChordKind] = useState<LearnChordKind>("home");
  const [learnPractice, setLearnPractice] = useState(false);
  const [round, setRound] = useState(0);
  const [hintCount, setHintCount] = useState(0);
  const [noteOrder, setNoteOrder] = useState(() => NOTE_ROUNDS.map((_, index) => index));
  const [chordOrder, setChordOrder] = useState(() => CHALLENGE_CHORDS.map((_, index) => index));
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<"idle" | "correct" | "try">("idle");
  const [stars, setStars] = useState(0);
  const [muted, setMuted] = useState(false);
  const [soundStatus, setSoundStatus] = useState<"sleeping" | "loading" | "ready" | "error">("sleeping");
  const audioRef = useRef<AudioContext | null>(null);
  const pianoRef = useRef<ReturnType<typeof Sampler> | null>(null);
  const pianoPromiseRef = useRef<Promise<ReturnType<typeof Sampler>> | null>(null);

  const currentFamily = CHORDS[learnIndex % CHORDS.length];
  const noteIndex = difficulty === "seedling" ? round % NOTE_ROUNDS.length : noteOrder[round % NOTE_ROUNDS.length];
  const chordIndex = difficulty === "seedling" ? round % CHALLENGE_CHORDS.length : chordOrder[round % CHALLENGE_CHORDS.length];
  const currentChord: Chord = mode === "learn"
    ? learnChordKind === "home" ? currentFamily : currentFamily.companion
    : CHALLENGE_CHORDS[chordIndex];
  const currentNote = NOTE_ROUNDS[noteIndex];
  const answer = mode === "note" ? [currentNote] : currentChord.notes;
  const maxSelection = mode === "note" ? 1 : 3;
  const seedlingHintCount = mode === "hear" && difficulty === "seedling" ? 1 : 0;
  const revealedNoteCount = mode === "hear"
    ? feedback === "correct" ? currentChord.notes.length : Math.max(hintCount, seedlingHintCount)
    : 0;
  const staffNotes = mode === "note"
    ? [currentNote]
    : mode === "hear" ? currentChord.notes.slice(0, revealedNoteCount) : currentChord.notes;
  const staffHidden = mode === "hear" && staffNotes.length === 0;

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

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setSelected([]);
    setFeedback("idle");
    setLearnPractice(false);
    setLearnChordKind("home");
    setRound(0);
    setHintCount(0);
    if (nextMode !== "learn" && difficulty !== "seedling") {
      if (nextMode === "note") setNoteOrder(shuffledIndices(NOTE_ROUNDS.length));
      else setChordOrder(shuffledIndices(CHALLENGE_CHORDS.length));
    }
  };

  const changeDifficulty = (nextDifficulty: Difficulty) => {
    setDifficulty(nextDifficulty);
    setSelected([]);
    setFeedback("idle");
    setRound(0);
    setHintCount(0);
    if (nextDifficulty !== "seedling") {
      setNoteOrder(shuffledIndices(NOTE_ROUNDS.length));
      setChordOrder(shuffledIndices(CHALLENGE_CHORDS.length));
    }
  };

  const handleKey = (note: string) => {
    void playNotes([note]);
    setFeedback("idle");
    if (selected.includes(note)) {
      setSelected(selected.filter((key) => key !== note));
      return;
    }
    if (maxSelection === 1) setSelected([note]);
    else if (selected.length < maxSelection) setSelected([...selected, note]);
  };

  const checkAnswer = () => {
    if (selected.length !== answer.length) {
      setFeedback("try");
      return;
    }
    if (sameNotes(selected, answer)) {
      setFeedback("correct");
      setStars((value) => value + 1);
      void playNotes(answer, false);
    } else {
      setFeedback("try");
    }
  };

  const revealHint = () => {
    setHintCount((value) => Math.min(currentChord.notes.length, Math.max(value, seedlingHintCount) + 1));
  };

  const nextRound = () => {
    setSelected([]);
    setFeedback("idle");
    setHintCount(0);
    if (mode === "learn") {
      setLearnPractice(false);
      if (learnChordKind === "home") setLearnChordKind("companion");
      else {
        setLearnChordKind("home");
        setLearnIndex((value) => (value + 1) % CHORDS.length);
      }
    } else {
      const count = mode === "note" ? NOTE_ROUNDS.length : CHALLENGE_CHORDS.length;
      const next = round + 1;
      if (difficulty !== "seedling" && next % count === 0) {
        if (mode === "note") setNoteOrder(shuffledIndices(count, noteOrder[round % count]));
        else setChordOrder(shuffledIndices(count, chordOrder[round % count]));
        setRound(0);
      } else setRound(next);
    }
  };

  const previousLearningChord = () => {
    setSelected([]);
    setFeedback("idle");
    setHintCount(0);
    setLearnPractice(false);
    if (learnChordKind === "companion") setLearnChordKind("home");
    else {
      setLearnChordKind("companion");
      setLearnIndex((value) => (value + CHORDS.length - 1) % CHORDS.length);
    }
  };

  const selectLearningChord = (kind: LearnChordKind) => {
    setLearnChordKind(kind);
    setSelected([]);
    setFeedback("idle");
    setHintCount(0);
    setLearnPractice(false);
  };

  const learningHighlights = useMemo(() => mode === "learn" && !learnPractice ? currentChord.notes : [], [currentChord.notes, learnPractice, mode]);
  const isPractice = mode !== "learn" || learnPractice;
  const showQuestionLabels = mode === "learn" || difficulty === "seedling";

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
        <nav className="mode-tabs mode-tabs--five" aria-label="Choose a game">
          <button className={mode === "learn" ? "active" : ""} onClick={() => switchMode("learn")}><span>01</span> Learn</button>
          <button className={mode === "note" ? "active" : ""} onClick={() => switchMode("note")}><span>02</span> Find a note</button>
          <button className={mode === "see" ? "active" : ""} onClick={() => switchMode("see")}><span>03</span> See a chord</button>
          <button className={mode === "hear" ? "active" : ""} onClick={() => switchMode("hear")}><span>04</span> Hear a chord</button>
          <button className={mode === "sheet" ? "active" : ""} onClick={() => switchMode("sheet")}><span>05</span> Sheet practice</button>
        </nav>

        {mode === "sheet" && (
          <SheetPracticeView onStarEarned={() => setStars((value) => value + 1)} />
        )}

        {mode !== "learn" && mode !== "sheet" && (
          <div className="difficulty-bar">
            <div>
              <span className="difficulty-label">Challenge level</span>
              <strong>
                {difficulty === "seedling" && "Names help you"}
                {difficulty === "explorer" && "No names + shuffled order"}
                {difficulty === "superstar" && "No names + shuffled surprises"}
              </strong>
            </div>
            <div className="difficulty-options" role="group" aria-label="Choose a difficulty level">
              <button className={difficulty === "seedling" ? "active" : ""} onClick={() => changeDifficulty("seedling")}><span>●</span> Seedling</button>
              <button className={difficulty === "explorer" ? "active" : ""} onClick={() => changeDifficulty("explorer")}><span>◆</span> Explorer</button>
              <button className={difficulty === "superstar" ? "active" : ""} onClick={() => changeDifficulty("superstar")}><span>★</span> Superstar</button>
            </div>
          </div>
        )}

        {mode !== "sheet" && <div className="lesson-grid">
          <div className="lesson-copy">
            <p className="eyebrow">
              {mode === "learn" && `Key family ${learnIndex + 1} of ${CHORDS.length} · ${learnChordKind === "home" ? "Home chord" : "Companion chord"}`}
              {mode === "note" && "Note detective"}
              {mode === "see" && "Chord puzzle"}
              {mode === "hear" && "Listening ears"}
            </p>
            <h1>
              {mode === "learn" && !learnPractice && <>Meet <em style={{ color: currentChord.color }}>{currentChord.name}</em></>}
              {mode === "learn" && learnPractice && <>Build <em style={{ color: currentChord.color }}>{currentChord.name}</em></>}
              {mode === "note" && <>Which note is <em>written?</em></>}
              {mode === "see" && <>Build the chord <em>you see.</em></>}
              {mode === "hear" && <>Build the chord <em>you hear.</em></>}
            </h1>
            <p className="lesson-description">
              {mode === "learn" && !learnPractice && currentChord.story}
              {mode === "learn" && learnPractice && `Tap ${prettyNotes(currentChord.notes).join(", ")} on the piano, then check your chord.`}
              {mode === "note" && "Look at the note on the music staff. Tap its matching piano key."}
              {mode === "see" && "Look at all three notes. Tap the matching piano keys to build the chord."}
              {mode === "hear" && "Press play, listen closely, then tap the three notes you heard."}
            </p>

            {mode === "learn" && !learnPractice && (
              <div className="chord-pair" role="group" aria-label={`${currentFamily.name} home and companion chords`}>
                <button className={learnChordKind === "home" ? "active" : ""} onClick={() => selectLearningChord("home")}>
                  <small>Home chord</small>
                  <strong>{currentFamily.name}</strong>
                  <span>{prettyNotes(currentFamily.notes).join(" · ")}</span>
                </button>
                <i aria-hidden="true">↔</i>
                <button className={learnChordKind === "companion" ? "active" : ""} onClick={() => selectLearningChord("companion")}>
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
                <button className="primary-action" onClick={() => void playNotes(currentChord.notes, false)}><span aria-hidden="true">▶</span> Play whole chord</button>
                <button className="text-action" onClick={() => void playNotes(currentChord.notes, true)}>Notes one by one <span>♪</span></button>
                <button className="text-action" onClick={() => { setLearnPractice(true); setSelected([]); }}>Let me build it <span>→</span></button>
              </div>
            )}
          </div>

          <div className="music-card" style={{ "--accent": currentChord.color } as React.CSSProperties}>
            <div className="music-card-top">
              <span>
                {mode === "learn" && currentChord.name}
                {mode === "note" && (showQuestionLabels ? `${noteLetter(currentNote)} · ${SOLFEGE[noteLetter(currentNote)]}` : "One mystery note")}
                {mode === "see" && (showQuestionLabels ? currentChord.name : "Mystery chord")}
                {mode === "hear" && (feedback === "correct" ? currentChord.name : "Listen")}
              </span>
              <small>
                {mode === "note" && "Treble clef"}
                {mode !== "note" && mode !== "hear" && "Bass clef"}
                {mode === "hear" && (feedback === "correct" ? "Bass clef" : revealedNoteCount > 0 ? `Hint ${revealedNoteCount}/3` : "Listen")}
              </small>
            </div>
            <Staff notes={staffNotes} hidden={staffHidden} clef={mode === "note" ? "treble" : "bass"} />
            {mode !== "note" && mode !== "hear" && <p className={`chord-formula ${!showQuestionLabels ? "is-hidden-hint" : ""}`}>{showQuestionLabels ? prettyNotes(currentChord.notes).join("  +  ") : "Read the three notes—no name clues this time"}</p>}
            {mode === "note" && <p className={`chord-formula ${!showQuestionLabels ? "is-hidden-hint" : ""}`}>{showQuestionLabels ? `${noteLetter(currentNote)} is ${SOLFEGE[noteLetter(currentNote)]}` : "Read the note—no name clue this time"}</p>}
            {mode === "hear" && (
              <p className="chord-formula">
                {feedback === "correct"
                  ? prettyNotes(currentChord.notes).join("  +  ")
                  : revealedNoteCount > 0 ? `${revealedNoteCount} of 3 notes revealed` : "No peeking—use your listening ears!"}
              </p>
            )}
          </div>
        </div>}

        {mode !== "sheet" && <div className="answer-zone">
          <div className="answer-status" aria-live="polite">
            {feedback === "idle" && <span>{isPractice ? difficulty === "superstar" ? "Build your answer, then check it" : `${selected.length} of ${answer.length} selected` : "The glowing keys make this chord"}</span>}
            {feedback === "try" && <span className="try-again">Almost! Listen and try once more.</span>}
            {feedback === "correct" && <span className="correct">★ You found it! Beautiful playing.</span>}
          </div>
          <div className="answer-actions">
            {isPractice && (
              <>
                <button className="answer-tool" onClick={() => void playNotes(answer, false)} aria-label={mode === "note" ? "Play the note" : "Play the chord"}>
                  <span aria-hidden="true">▶</span> Hear
                </button>
                {mode !== "note" && (
                  <button className="answer-tool" onClick={() => void playNotes(answer, true)} aria-label="Play the chord notes one by one">
                    <span aria-hidden="true">♪</span> Notes
                  </button>
                )}
                {mode === "hear" && feedback !== "correct" && (
                  <button
                    className="answer-tool hint-button"
                    onClick={revealHint}
                    disabled={revealedNoteCount >= currentChord.notes.length}
                    aria-label={`Reveal another chord note. ${revealedNoteCount} of ${currentChord.notes.length} shown`}
                  >
                    <span aria-hidden="true">◆</span> Hint {revealedNoteCount}/3
                  </button>
                )}
                <button className={`check-button ${feedback === "correct" ? "next" : ""}`} onClick={feedback === "correct" ? nextRound : checkAnswer}>
                  {feedback === "correct" ? "Next →" : mode === "note" ? "Check note" : "Check chord"}
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
        </div>}

        {mode !== "sheet" && <Piano selected={selected} glowing={learningHighlights} onPress={handleKey} register={mode === "note" ? "treble" : "bass"} />}
      </section>

      <footer>
        <p>Made for curious little musicians</p>
        <span>Listen • Look • Play</span>
      </footer>
    </main>
  );
}
