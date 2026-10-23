"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMPTY_SIGNATURE } from "../lib/music-theory";
import { createTone } from "../lib/piano-sampler";
import { PIANO_TONES, type PianoTone } from "../lib/piano-tones";
import type { Sounding } from "../lib/naming";
import { beatSecondsForTempo, scoreLengthSeconds, scoreSchedule, SCAN_TEMPO_PRESETS, type ScanTempoId } from "../lib/sheet-playback";
import type { ScannedEvent, SheetRecognitionResult } from "../lib/sheet-recognition";
import { APP_VERSION, RELEASE_PATH, SHEET_SCAN_PATH } from "../lib/version";
import { Piano } from "./piano";
import { SheetScanner } from "./sheet-scanner";
import { Staff } from "./staff";

export default function SheetPlayPage() {
  const [muted, setMuted] = useState(false);
  const [soundStatus, setSoundStatus] = useState<"sleeping" | "loading" | "ready" | "error">("sleeping");
  const audioRef = useRef<AudioContext | null>(null);
  const [tone, setTone] = useState<PianoTone>("upright");
  const pianoRef = useRef<Awaited<ReturnType<typeof createTone>> | null>(null);
  const toneRef = useRef<PianoTone>("upright");
  const loadedToneRef = useRef<PianoTone | null>(null);
  const loadIdRef = useRef(0);

  const [scannedEvents, setScannedEvents] = useState<ScannedEvent[]>([]);
  const [scannedPageCount, setScannedPageCount] = useState(0);
  const [scanWarnings, setScanWarnings] = useState<string[]>([]);
  const [scanTempo, setScanTempo] = useState<ScanTempoId>("steady");
  const [scanTrebleGlow, setScanTrebleGlow] = useState<string[]>([]);
  const [scanBassGlow, setScanBassGlow] = useState<string[]>([]);
  const [scanStaffPreview, setScanStaffPreview] = useState<ScannedEvent | null>(null);
  const scanTimersRef = useRef<number[]>([]);

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

  const playNotes = useCallback(async (notes: string[]) => {
    if (muted || notes.length === 0) return;
    try {
      const piano = await getPiano();
      const context = audioRef.current;
      if (!context) return;
      if (context.state === "suspended") await context.resume();
      notes.forEach((note) => piano.start({ note, time: context.currentTime + 0.02, duration: 2.25, velocity: 84 }));
    } catch {
      // The visible sound status explains that the samples could not load.
    }
  }, [getPiano, muted]);

  const clearScanTimers = useCallback(() => {
    scanTimersRef.current.forEach((id) => window.clearTimeout(id));
    scanTimersRef.current = [];
  }, []);

  const playScannedScore = useCallback(async (events: ScannedEvent[], tempo: ScanTempoId) => {
    clearScanTimers();
    setScanTrebleGlow([]);
    setScanBassGlow([]);
    setScanStaffPreview(null);
    if (events.length === 0) return;
    const beatSeconds = beatSecondsForTempo(tempo);
    const beatMs = beatSeconds * 1000;
    events.forEach((event, index) => {
      const startId = window.setTimeout(() => {
        setScanStaffPreview(event);
        setScanTrebleGlow(event.treble.filter((pitch) => !pitch.tiedFromPrevious).map((pitch) => pitch.note));
        setScanBassGlow(event.bass.filter((pitch) => !pitch.tiedFromPrevious).map((pitch) => pitch.note));
      }, index * beatMs);
      scanTimersRef.current.push(startId);
    });
    const endId = window.setTimeout(() => {
      setScanTrebleGlow([]);
      setScanBassGlow([]);
      setScanStaffPreview(null);
    }, scoreLengthSeconds(events, beatSeconds) * 1000 + 80);
    scanTimersRef.current.push(endId);
    await playSoundings(scoreSchedule(events, beatSeconds));
  }, [clearScanTimers, playSoundings]);

  const handleScanResult = useCallback((result: SheetRecognitionResult, options?: { append?: boolean }) => {
    if (!result.ok) {
      if (!options?.append) {
        setScannedEvents([]);
        setScannedPageCount(0);
        setScanStaffPreview(null);
      }
      setScanWarnings([result.reason]);
      return;
    }
    const nextEvents = options?.append ? [...scannedEvents, ...result.events] : result.events;
    const nextPages = options?.append
      ? scannedPageCount + (result.pages ?? 1)
      : (result.pages ?? 1);
    setScannedEvents(nextEvents);
    setScannedPageCount(nextPages);
    setScanWarnings(result.warnings ?? []);
    void playScannedScore(nextEvents, scanTempo);
  }, [playScannedScore, scanTempo, scannedEvents, scannedPageCount]);

  useEffect(() => () => clearScanTimers(), [clearScanTimers]);

  return (
    <main>
      <header className="topbar">
        <Link className="brand" href={RELEASE_PATH} aria-label="Back to Piano Picnic games">
          <span className="brand-mark"><i /><i /><i /></span>
          <span>Piano Picnic</span>
        </Link>
        <div className="top-actions">
          <Link className="sheet-play-back" href={RELEASE_PATH}>← Games</Link>
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

      <section className="game sheet-play" id="top">
        <div className="scan-layout">
          <div className="lesson-copy">
            <p className="eyebrow">Sheet camera</p>
            <h1>Read the music, <em>hear it play.</em></h1>
            <p className="lesson-description">
              Point the camera at piano music with treble and bass staves, or upload two or more page photos in order.
              We read noteheads, staccato dots, ties, and slurs, then play them on both keyboards while the keys light up.
            </p>
            <div className="scan-tempo" role="group" aria-label="Playback speed">
              <span className="scan-tempo__label">Speed</span>
              {SCAN_TEMPO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={scanTempo === preset.id ? "active" : ""}
                  aria-pressed={scanTempo === preset.id}
                  onClick={() => setScanTempo(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <SheetScanner onResult={handleScanResult} hasScore={scannedEvents.length > 0} />
            {scanWarnings.length > 0 && (
              <p className="scan-warning" role="status">{scanWarnings.join(" ")}</p>
            )}
            {scannedEvents.length > 0 && (
              <div className="scan-replay">
                <button type="button" className="text-action" onClick={() => void playScannedScore(scannedEvents, scanTempo)}>
                  Play again <span>♪</span>
                </button>
              </div>
            )}
          </div>
          <div className="scan-staves">
            <div className="music-card" style={{ "--accent": "#6f9d83" } as React.CSSProperties}>
              <div className="music-card-top">
                <span>{scannedEvents.length > 0 ? "Treble staff" : "Waiting for music"}</span>
                <small>Treble clef</small>
              </div>
              <Staff
                notes={scanStaffPreview ? scanStaffPreview.treble.map((pitch) => pitch.note) : scannedEvents.flatMap((event) => event.treble.map((pitch) => pitch.note))}
                clef="treble"
                signature={EMPTY_SIGNATURE}
              />
            </div>
            <div className="music-card" style={{ "--accent": "#4e8fa8" } as React.CSSProperties}>
              <div className="music-card-top">
                <span>{scannedEvents.length > 0 ? "Bass staff" : "Waiting for music"}</span>
                <small>Bass clef</small>
              </div>
              <Staff
                notes={scanStaffPreview ? scanStaffPreview.bass.map((pitch) => pitch.note) : scannedEvents.flatMap((event) => event.bass.map((pitch) => pitch.note))}
                clef="bass"
                signature={EMPTY_SIGNATURE}
              />
            </div>
            <p className="chord-formula scan-staves__caption">
              {scannedEvents.length > 0
                ? `${scannedPageCount} page${scannedPageCount === 1 ? "" : "s"} · ${scannedEvents.length} chord${scannedEvents.length === 1 ? "" : "s"} · ${SCAN_TEMPO_PRESETS.find((preset) => preset.id === scanTempo)?.label ?? "Steady"} tempo`
                : "Scan or upload grand-staff pages to see treble and bass together."}
            </p>
          </div>
        </div>

        <div className="scan-keyboards">
          <Piano
            selected={[]}
            glowing={scanTrebleGlow}
            labeled={true}
            onPress={(note) => void playNotes([note])}
            register="treble"
            caption="Treble keys light up with the top staff"
          />
          <Piano
            selected={[]}
            glowing={scanBassGlow}
            labeled={true}
            onPress={(note) => void playNotes([note])}
            register="bass"
            caption="Bass keys light up with the bottom staff"
          />
        </div>
      </section>

      <footer>
        <p>Sheet reader · separate from the learning games</p>
        <span>{SHEET_SCAN_PATH} · {APP_VERSION}</span>
      </footer>
    </main>
  );
}
