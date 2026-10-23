"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DIFFICULTIES,
  DIFFICULTY_RULES,
  afterCorrectRound,
  difficultySummary,
  hearInstruction,
  questionIndex,
  showsPianoLabels,
  showsQuestionNames,
  type Difficulty,
  type GameMode,
} from "../lib/difficulty";
import { hintView } from "../lib/hints";
import {
  CHALLENGE_CHORDS,
  CHORDS,
  NOTE_ROUNDS,
  SOLFEGE,
  EMPTY_SIGNATURE,
  gradeAnswer,
  noteLetter,
  prettyNotes,
  shuffledIndices,
  type Chord,
} from "../lib/music-theory";
import {
  EAR_NOTES,
  choiceSchedule,
  deckLength,
  gradeChoice,
  nameAnswerLabel,
  nameChoices,
  nameHint,
  nameInstruction,
  nameQuestion,
  nameSchedule,
  type NameDeck,
  type Sounding,
} from "../lib/naming";
import { sendAnalytics } from "../lib/browser-report";
import { matchShortcut, shortcutApplies, shortcutHelp, type ShortcutId } from "../lib/shortcuts";
import { PIANO_TONES, type PianoTone } from "../lib/piano-tones";
import { createTone, type Playable } from "../lib/piano-sampler";
import { APP_VERSION, RELEASE_PATH, SHEET_SCAN_PATH } from "../lib/version";
import { Piano } from "../components/piano";
import { Staff } from "../components/staff";

type LearnChordKind = "home" | "companion";
type Feedback = "idle" | "correct" | "incomplete" | "incorrect";

function dealOrder(length: number, level: Difficulty) {
  return DIFFICULTY_RULES[level].order === "fixed"
    ? Array.from({ length }, (_, index) => index)
    : shuffledIndices(length);
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
  const [nameDeck, setNameDeck] = useState<NameDeck>("note");
  const [nameOrder, setNameOrder] = useState(() => EAR_NOTES.map((_, index) => index));
  const [choice, setChoice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<Feedback>("idle");
  const [stars, setStars] = useState(0);
  const [muted, setMuted] = useState(false);
  const [soundStatus, setSoundStatus] = useState<"sleeping" | "loading" | "ready" | "error">("sleeping");
  const audioRef = useRef<AudioContext | null>(null);
  const [tone, setTone] = useState<PianoTone>("upright");
  const pianoRef = useRef<Playable | null>(null);
  const toneRef = useRef<PianoTone>("upright");
  const loadedToneRef = useRef<PianoTone | null>(null);
  const loadIdRef = useRef(0);
  const gradingRef = useRef(false);
  const currentFamily = CHORDS[learnIndex % CHORDS.length];
  const noteIndex = questionIndex(difficulty, round, noteOrder, NOTE_ROUNDS.length);
  const chordIndex = questionIndex(difficulty, round, chordOrder, CHALLENGE_CHORDS.length);
  const currentChord: Chord = mode === "learn"
    ? learnChordKind === "home" ? currentFamily : currentFamily.companion
    : CHALLENGE_CHORDS[chordIndex];
  const currentNote = NOTE_ROUNDS[noteIndex];
  const nameLength = deckLength(nameDeck);
  const ear = useMemo(
    () => nameQuestion(nameDeck, questionIndex(difficulty, round, nameOrder, nameLength)),
    [difficulty, nameDeck, nameLength, nameOrder, round],
  );
  const answer = useMemo(() => (mode === "note" ? [currentNote] : currentChord.notes), [currentChord.notes, currentNote, mode]);
  const maxSelection = mode === "note" ? 1 : 3;
  const isPractice = mode !== "learn" || learnPractice;
  const showQuestionLabels = showsQuestionNames(difficulty, mode, isPractice);
  const builtHint = hintView({
    mode: mode === "name" ? "learn" : mode,
    difficulty,
    answer,
    selected,
    hintsUsed: hintCount,
    chord: { quality: currentChord.quality, root: currentChord.root },
  });
  const heardHint = nameHint({ question: ear, difficulty, hintsUsed: hintCount });
  const hint = mode === "name"
    ? { message: heardHint.message, staffNotes: [] as string[], glowNotes: heardHint.glowNotes, hintsUsed: heardHint.hintsUsed, budget: heardHint.budget }
    : builtHint;
  const namedStaff = mode !== "name" || feedback !== "correct"
    ? []
    : ear.deck === "note" && ear.note
      ? [ear.note]
      : ear.deck === "home" && ear.chord
        ? ear.chord.notes
        : [];
  const staffNotes = mode === "name"
    ? namedStaff
    : mode === "note"
      ? [currentNote]
      : mode === "hear"
        ? (feedback === "correct" ? currentChord.notes : hint.staffNotes)
        : currentChord.notes;
  const staffHidden = staffNotes.length === 0 && (mode === "hear" || mode === "name");
  const glowing = mode === "name"
    ? (feedback === "correct" ? [] : heardHint.glowNotes)
    : !isPractice ? currentChord.notes : feedback === "correct" ? [] : hint.glowNotes;
  const cardChord = mode === "name" && ear.chord ? ear.chord : currentChord;
  const cardColor = mode === "name" ? (ear.chord?.color ?? "#4e8fa8") : currentChord.color;

  const getPiano = useCallback(async () => {
    const requested = toneRef.current;
    if (pianoRef.current && loadedToneRef.current === requested) return pianoRef.current;

    const loadId = ++loadIdRef.current;
    pianoRef.current = null;
    setSoundStatus("loading");
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = audioRef.current ?? new AudioContextClass();
    audioRef.current = context;
    if (context.state === "suspended") await context.resume();

    try {
      const piano = await createTone(context, requested);
      if (loadId !== loadIdRef.current) return piano;
      pianoRef.current = piano;
      loadedToneRef.current = requested;
      setSoundStatus("ready");
      return piano;
    } catch (error) {
      console.error("Could not load the piano samples", error);
      if (loadId === loadIdRef.current) setSoundStatus("error");
      throw error;
    }
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
    setChoice(null);
    setFeedback("idle");
    setHintCount(0);
  }, []);

  const playSoundings = useCallback(async (schedule: Sounding[]) => {
    if (muted || schedule.length === 0) return;
    try {
      const piano = await getPiano();
      const context = audioRef.current;
      if (!context) return;
      if (context.state === "suspended") await context.resume();
      const start = context.currentTime + 0.02;
      for (const event of schedule) {
        event.notes.forEach((note) => piano.start({ note, time: start + event.at, duration: event.duration, velocity: 84 }));
      }
    } catch {
      // The visible sound status explains that the samples could not load.
    }
  }, [getPiano, muted]);

  const playNaming = useCallback(async (deck: NameDeck, level: Difficulty, roundIndex: number, order: number[]) => {
    const question = nameQuestion(deck, questionIndex(level, roundIndex, order, deckLength(deck)));
    await playSoundings(nameSchedule(level, question));
  }, [playSoundings]);

  const switchMode = (nextMode: GameMode) => {
    sendAnalytics({ event: "mode_change", mode: nextMode, difficulty });
    setMode(nextMode);
    setLearnPractice(false);
    setLearnChordKind("home");
    setRound(0);
    resetAnswer();
    if (nextMode === "name") {
      const order = dealOrder(deckLength(nameDeck), difficulty);
      setNameOrder(order);
      void playNaming(nameDeck, difficulty, 0, order);
    } else if (nextMode !== "learn" && DIFFICULTY_RULES[difficulty].order === "shuffled") {
      if (nextMode === "note") setNoteOrder(shuffledIndices(NOTE_ROUNDS.length));
      else setChordOrder(shuffledIndices(CHALLENGE_CHORDS.length));
    }
  };

  const changeDifficulty = (nextDifficulty: Difficulty) => {
    sendAnalytics({ event: "difficulty_change", mode, difficulty: nextDifficulty });
    setDifficulty(nextDifficulty);
    setRound(0);
    resetAnswer();
    const nextNameOrder = dealOrder(deckLength(nameDeck), nextDifficulty);
    setNameOrder(nextNameOrder);
    if (DIFFICULTY_RULES[nextDifficulty].order === "shuffled") {
      setNoteOrder(shuffledIndices(NOTE_ROUNDS.length));
      setChordOrder(shuffledIndices(CHALLENGE_CHORDS.length));
    }
    if (mode === "name") void playNaming(nameDeck, nextDifficulty, 0, nextNameOrder);
  };

  const handleKey = (note: string) => {
    if (mode === "name" && nameDeck !== "note") {
      void playNotes([note]);
      return;
    }
    if (feedback === "correct") return;
    void playNotes([note]);
    setFeedback("idle");
    if (mode === "name") {
      setChoice(choice === note ? null : note);
      return;
    }
    if (selected.includes(note)) {
      setSelected(selected.filter((key) => key !== note));
      return;
    }
    if (maxSelection === 1) setSelected([note]);
    else if (selected.length < maxSelection) setSelected([...selected, note]);
  };

  const checkAnswer = useCallback(() => {
    if (gradingRef.current) return;
    if (mode === "name") {
      const result = gradeChoice(choice, ear.answerId);
      sendAnalytics({ event: "answer_checked", mode, difficulty, correct: result === "correct" });
      if (result === "correct") {
        gradingRef.current = true;
        setFeedback("correct");
        setStars((value) => value + 1);
        void playNaming(nameDeck, difficulty, round, nameOrder);
        return;
      }
      setFeedback(result);
      return;
    }
    const result = gradeAnswer(selected, answer);
    sendAnalytics({ event: "answer_checked", mode, difficulty, correct: result === "correct" });
    if (result === "correct") {
      gradingRef.current = true;
      setFeedback("correct");
      setStars((value) => value + 1);
      void playNotes(answer, false);
      return;
    }
    setFeedback(result);
  }, [answer, choice, difficulty, ear.answerId, mode, nameDeck, nameOrder, playNaming, playNotes, round, selected]);

  const revealHint = useCallback(() => {
    if (feedback === "correct" || hintCount >= hint.budget) return;
    setHintCount((value) => Math.min(hint.budget, value + 1));
    setFeedback("idle");
    sendAnalytics({ event: "hint_used", mode, difficulty });
  }, [difficulty, feedback, hint.budget, hintCount, mode]);

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
    const length = mode === "name" ? nameLength : mode === "note" ? NOTE_ROUNDS.length : CHALLENGE_CHORDS.length;
    const order = mode === "name" ? nameOrder : mode === "note" ? noteOrder : chordOrder;
    const next = afterCorrectRound({ difficulty, round, length, order });
    setRound(next.round);
    if (mode === "name") {
      setNameOrder(next.order);
      void playNaming(nameDeck, difficulty, next.round, next.order);
    } else if (mode === "note") setNoteOrder(next.order);
    else setChordOrder(next.order);
  }, [chordOrder, difficulty, learnChordKind, mode, nameDeck, nameLength, nameOrder, noteOrder, playNaming, resetAnswer, round]);

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
    if (id === "hearChord" || id === "hearNotes") {
      if (mode === "name") void playNaming(nameDeck, difficulty, round, nameOrder);
      else void playNotes(notes, id === "hearNotes");
      sendAnalytics({ event: "shortcut_used", shortcut: id, mode, difficulty });
      return true;
    }
    if (id === "hint") {
      if (feedback === "correct" || hintCount >= hint.budget) return false;
      revealHint();
      sendAnalytics({ event: "shortcut_used", shortcut: id, mode, difficulty });
      return true;
    }
    if (feedback === "correct") nextRound();
    else checkAnswer();
    sendAnalytics({ event: "shortcut_used", shortcut: id, mode, difficulty });
    return true;
  }, [answer, checkAnswer, currentChord.notes, difficulty, feedback, hint.budget, hintCount, isPractice, mode, nameDeck, nameOrder, nextRound, playNaming, playNotes, revealHint, round]);

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

  useEffect(() => {
    sendAnalytics({ event: "page_view", mode: "learn", difficulty: "seedling", path: RELEASE_PATH });
  }, []);

  const hearTitle = mode === "note" ? "Hear note" : "Hear chord";

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Piano Picnic home">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Piano Picnic</span>
        </a>
        <div className="top-actions">
          <Link className="sheet-play-link" href={SHEET_SCAN_PATH}>Play a sheet</Link>
          <div className="star-score" aria-label={`${stars} stars earned`}><span>★</span>{stars}</div>
          <div className="tone-picker" role="group" aria-label="Choose a piano sound">
            {PIANO_TONES.map((option) => (
              <button
                key={option.id}
                className={tone === option.id ? "active" : ""}
                aria-pressed={tone === option.id}
                onClick={() => {
                  if (tone === option.id) return;
                  toneRef.current = option.id;
                  loadedToneRef.current = null;
                  pianoRef.current = null;
                  loadIdRef.current += 1;
                  setTone(option.id);
                  if (!muted) void getPiano().catch(() => undefined);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            className={`sound-button sound-button--${soundStatus}`}
            onClick={() => {
              if (muted || soundStatus === "error") {
                setMuted(false);
                void getPiano().catch(() => undefined);
              } else setMuted(true);
            }}
            aria-label={muted ? "Turn piano sound on" : "Turn sound off"}
          >
            {soundStatus === "loading" ? "Loading piano" : soundStatus === "error" ? "Try sound" : muted ? "Sound off" : PIANO_TONES.find((option) => option.id === tone)?.label}
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
          <button className={mode === "name" ? "active" : ""} aria-pressed={mode === "name"} onClick={() => switchMode("name")}><span>05</span> Name it</button>
        </nav>

        <p className="shortcut-legend">
          <span>While you answer</span>
          {shortcutHelp(mode, isPractice).map((shortcut) => (
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
              {mode === "name" && "Name what you hear"}
            </p>
            <h1>
              {mode === "learn" && !learnPractice && <>Meet <em style={{ color: currentChord.color }}>{currentChord.name}</em></>}
              {mode === "learn" && learnPractice && showQuestionLabels && <>Build <em style={{ color: currentChord.color }}>{currentChord.name}</em></>}
              {mode === "learn" && learnPractice && !showQuestionLabels && <>Build <em>this chord.</em></>}
              {mode === "note" && <>Which note is <em>written?</em></>}
              {mode === "see" && <>Build the chord <em>you see.</em></>}
              {mode === "hear" && <>Build the chord <em>you hear.</em></>}
              {mode === "name" && ear.deck === "note" && <>Which note did you <em>hear?</em></>}
              {mode === "name" && ear.deck === "home" && <>Which home chord was <em>that?</em></>}
              {mode === "name" && ear.deck === "journey" && <>Which journey did you <em>hear?</em></>}
            </h1>
            <p className="lesson-description">
              {mode === "learn" && !learnPractice && currentChord.story}
              {mode === "learn" && learnPractice && showQuestionLabels && `Tap ${prettyNotes(currentChord.notes).join(", ")} on the piano, then check your chord.`}
              {mode === "learn" && learnPractice && !showQuestionLabels && "Build the chord on the piano, then check it. A hint can help."}
              {mode === "note" && "Look at the note on the music staff. Tap its matching piano key."}
              {mode === "see" && "Look at all three notes. Tap the matching piano keys to build the chord."}
              {mode === "hear" && hearInstruction(difficulty)}
              {mode === "name" && nameInstruction(nameDeck, difficulty)}
            </p>

            {mode === "name" && (
              <div className="name-decks" role="group" aria-label="Choose what to name">
                {([
                  ["note", "Note"],
                  ["home", "Home chord"],
                  ["journey", "Journey"],
                ] as const).map(([deck, label]) => (
                  <button
                    key={deck}
                    className={nameDeck === deck ? "active" : ""}
                    aria-pressed={nameDeck === deck}
                    onClick={() => {
                      const order = dealOrder(deckLength(deck), difficulty);
                      setNameDeck(deck);
                      setNameOrder(order);
                      setRound(0);
                      resetAnswer();
                      void playNaming(deck, difficulty, 0, order);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

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

          <div className="music-card" style={{ "--accent": cardColor } as React.CSSProperties}>
            <div className="music-card-top">
              <span>
                {mode === "learn" && (showQuestionLabels ? currentChord.name : "Your turn")}
                {mode === "note" && (showQuestionLabels ? `${noteLetter(currentNote)} · ${SOLFEGE[noteLetter(currentNote)]}` : "One mystery note")}
                {mode === "see" && (showQuestionLabels ? currentChord.name : "Mystery chord")}
                {mode === "hear" && (feedback === "correct" ? currentChord.name : hint.staffNotes.length > 0 && hint.hintsUsed === 0 ? "Starting note" : "Listen")}
                {mode === "name" && (feedback === "correct" ? nameAnswerLabel(ear) : "Listen")}
              </span>
              <small>
                {mode === "note" && "Treble clef"}
                {mode !== "note" && mode !== "hear" && mode !== "name" && "Bass clef"}
                {mode === "hear" && (feedback === "correct" ? "Bass clef" : hint.hintsUsed > 0 ? `Hint ${hint.hintsUsed}/${hint.budget}` : hint.staffNotes.length > 0 ? "Starting note" : "Listen")}
                {mode === "name" && (feedback === "correct" ? (ear.deck === "note" ? "Treble clef" : "Bass clef") : "Your ears")}
              </small>
            </div>
            <Staff
              notes={staffNotes}
              hidden={staffHidden}
              clef={mode === "note" || (mode === "name" && ear.deck === "note") ? "treble" : "bass"}
              signature={mode === "note" || (mode === "name" && ear.deck !== "home") ? EMPTY_SIGNATURE : cardChord.signature}
            />
            {mode !== "note" && mode !== "hear" && mode !== "name" && <p className={`chord-formula ${!showQuestionLabels ? "is-hidden-hint" : ""}`}>{showQuestionLabels ? prettyNotes(currentChord.notes).join("  +  ") : "Read the three notes—no name clues this time"}</p>}
            {mode === "note" && <p className={`chord-formula ${!showQuestionLabels ? "is-hidden-hint" : ""}`}>{showQuestionLabels ? `${noteLetter(currentNote)} is ${SOLFEGE[noteLetter(currentNote)]}` : "Read the note—no name clue this time"}</p>}
            {mode === "hear" && (
              <p className="chord-formula">
                {feedback === "correct"
                  ? prettyNotes(currentChord.notes).join("  +  ")
                  : hint.hintsUsed === 0 && hint.staffNotes.length > 0
                    ? "One note is written to start you off."
                    : hint.hintsUsed > 0 ? `${hint.hintsUsed} of ${hint.budget} hints used` : "No peeking—use your listening ears!"}
              </p>
            )}
            {mode === "name" && (
              <p className="chord-formula">
                {feedback === "correct"
                  ? (nameChoices(ear, "seedling").find((option) => option.id === ear.answerId)?.detail || nameAnswerLabel(ear))
                  : nameDeck === "note" && difficulty === "seedling"
                    ? "Middle Do plays first."
                    : "Hear it, then name it."}
              </p>
            )}
            {isPractice && feedback !== "correct" && hint.message && <p className="hint-banner" role="status">{hint.message}</p>}
          </div>
        </div>

        <div className="answer-zone">
          <div className="answer-status" aria-live="polite">
            {feedback === "idle" && <span>{mode === "name" ? (choice ? "Answer chosen" : "Listen, then choose") : isPractice ? `${selected.length} of ${answer.length} selected` : "The glowing keys make this chord"}</span>}
            {feedback === "incomplete" && <span className="try-again">{mode === "name" ? "Choose an answer, then check." : "Choose every note, then check."}</span>}
            {feedback === "incorrect" && <span className="try-again">{mode === "hear" || mode === "name" ? "Not quite. Listen again, or ask for a hint." : "Not quite. Look again, or ask for a hint."}</span>}
            {feedback === "correct" && <span className="correct">{mode === "name" ? "★ You named it!" : "★ You found it! Beautiful playing."}</span>}
          </div>
          <div className="answer-actions">
            {isPractice && (
              <>
                <button className="answer-tool" onClick={() => { if (mode === "name") void playNaming(nameDeck, difficulty, round, nameOrder); else void playNotes(answer, false); }} aria-label={mode === "name" ? "Hear it" : hearTitle} aria-keyshortcuts="C">
                  <span aria-hidden="true">▶</span> {mode === "name" ? "Hear it" : hearTitle} <kbd>C</kbd>
                </button>
                {mode !== "note" && mode !== "name" && (
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
                  {feedback === "correct" ? "Next" : mode === "name" ? "Check" : mode === "note" ? "Check note" : "Check chord"} <kbd>Enter</kbd>
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

        {mode === "name" && nameDeck !== "note" && (
          <div className={`name-choices name-choices--${nameDeck}`} role="group" aria-label={nameDeck === "home" ? "Home chords" : "Journeys"}>
            {nameChoices(ear, difficulty).map((option) => (
              <button
                key={option.id}
                className={`name-choice ${choice === option.id ? "is-selected" : ""} ${heardHint.choiceId === option.id && feedback !== "correct" ? "is-glowing" : ""}`}
                style={{ "--choice": option.color } as React.CSSProperties}
                aria-pressed={choice === option.id}
                onClick={() => {
                  if (feedback === "correct") return;
                  setChoice(option.id);
                  setFeedback("idle");
                  if (difficulty === "seedling") void playSoundings(choiceSchedule(difficulty, ear, option.id));
                }}
              >
                <strong>{option.title}</strong>
                {option.detail && <small>{option.detail}</small>}
              </button>
            ))}
          </div>
        )}
        {(mode !== "name" || nameDeck === "note" || difficulty === "seedling") && (
          <Piano
            selected={mode === "name" && nameDeck === "note" && choice ? [choice] : selected}
            glowing={glowing}
            labeled={showsPianoLabels(difficulty)}
            onPress={handleKey}
            register={mode === "note" || (mode === "name" && nameDeck === "note") ? "treble" : "bass"}
            whiteKeys={mode === "name" && nameDeck === "note" ? EAR_NOTES : undefined}
            caption={mode === "name" && nameDeck === "note" ? "Tap the note you heard" : mode === "name" ? "Try playing what you heard" : "Tap the piano keys to answer"}
          />
        )}
      </section>

      <footer>
        <p>Made for curious little musicians · <Link href={SHEET_SCAN_PATH}>Sheet reader</Link></p>
        <span>Listen • Look • Play · {APP_VERSION}</span>
      </footer>
    </main>
  );
}
