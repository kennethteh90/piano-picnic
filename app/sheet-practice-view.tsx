"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Staff } from "./components/staff";
import { decodeAudioBlobToMono, analyzeRecording } from "./lib/analyze-recording";
import { matchPerformanceToScore, practiceSummary, gradePractice, type NoteMatchResult, type PracticeGrade } from "./lib/performance-match";
import { prettyNotes, TREBLE_KEYS } from "./lib/music-theory";
import { BUILT_IN_SAMPLES, extractScoreFromImageFile } from "./lib/sheet-omr";
import { scoreFromNoteNames, scoreNoteNames, type SheetScore } from "./lib/sheet-score";
import { midiToNote } from "./lib/note-pitch";

type RecordPhase = "idle" | "recording" | "analyzing" | "done";

const GRADE_COPY: Record<PracticeGrade, string> = {
  pass: "★ You played it! Every note matched.",
  partial: "◆ Nice try! Some notes were right — keep going.",
  fail: "Try again — listen to the notes and play one at a time.",
};

export function SheetPracticeView({ onStarEarned }: { onStarEarned: () => void }) {
  const [score, setScore] = useState<SheetScore | null>(null);
  const [omrMessage, setOmrMessage] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [recordPhase, setRecordPhase] = useState<RecordPhase>("idle");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [results, setResults] = useState<NoteMatchResult[] | null>(null);
  const [grade, setGrade] = useState<PracticeGrade | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const displayNotes = useMemo(() => (score ? scoreNoteNames(score) : []), [score]);

  const loadSample = useCallback((id: string) => {
    const sample = BUILT_IN_SAMPLES.find((s) => s.id === id);
    if (!sample) return;
    setScore(scoreFromNoteNames(sample.notes, "treble", sample.bpm ?? 72, sample.title));
    setOmrMessage("Sample melody loaded — no upload needed.");
    setUploadPreview(null);
    setResults(null);
    setGrade(null);
    setRecordPhase("idle");
  }, []);

  const onFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setRecordError(null);
    setResults(null);
    setGrade(null);
    setRecordPhase("idle");
    setUploadPreview(URL.createObjectURL(file));
    try {
      const omr = await extractScoreFromImageFile(file);
      setScore(omr.score.notes.length ? omr.score : scoreFromNoteNames(["C4", "D4", "E4"], "treble"));
      setOmrMessage(omr.message ?? (omr.source === "vision" ? "Notes read from your picture." : "Ready to practice."));
    } catch {
      setScore(scoreFromNoteNames(["C4", "D4", "E4"], "treble"));
      setOmrMessage("Could not read that image — edit the notes below.");
    }
  }, []);

  const updateNoteAt = (index: number, name: string) => {
    if (!score) return;
    const names = scoreNoteNames(score);
    names[index] = name;
    setScore(scoreFromNoteNames(names, score.clef, score.bpm, score.title));
    setResults(null);
    setGrade(null);
  };

  const addNote = () => {
    const base = score ?? scoreFromNoteNames([], "treble");
    setScore(scoreFromNoteNames([...scoreNoteNames(base), "C4"], base.clef, base.bpm, base.title));
  };

  const removeNote = (index: number) => {
    if (!score) return;
    const names = scoreNoteNames(score).filter((_, i) => i !== index);
    setScore(scoreFromNoteNames(names, score.clef, score.bpm, score.title));
  };

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecording = async () => {
    if (!score || score.notes.length === 0) return;
    setRecordError(null);
    setResults(null);
    setGrade(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        stopStream();
        setRecordPhase("analyzing");
        try {
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
          const { samples, sampleRate } = await decodeAudioBlobToMono(blob);
          const detected = analyzeRecording(samples, sampleRate, score);
          const matched = matchPerformanceToScore(score, detected);
          const g = gradePractice(matched);
          setResults(matched);
          setGrade(g);
          if (g === "pass") onStarEarned();
        } catch {
          setRecordError("We could not hear notes in that recording. Try again closer to the mic.");
        } finally {
          setRecordPhase("done");
        }
      };
      recorder.start();
      setRecordPhase("recording");
    } catch {
      setRecordError("Microphone blocked. Ask a grown-up to allow the mic in browser settings.");
      setRecordPhase("idle");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
  };

  const summary = results ? practiceSummary(results) : null;

  return (
    <div className="sheet-practice">
      <div className="lesson-grid">
        <div className="lesson-copy">
          <p className="eyebrow">Sheet practice · real instrument</p>
          <h1>Play the notes <em>on your sheet.</em></h1>
          <p className="lesson-description">
            Upload a treble-clef practice photo or pick a sample melody. Tap Record, play each note on your piano or keyboard
            (one note at a time), then stop. We listen and tell you which notes matched.
          </p>
          <p className="sheet-limit-note">
            Monophonic treble only for now — one note at a time, about {score?.bpm ?? 72} beats per minute.
            Timing can wiggle by about one beat either way.
          </p>

          <div className="sheet-upload-row">
            <label className="primary-action sheet-file-label">
              <span aria-hidden="true">↑</span> Upload sheet photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sheet-file-input"
                onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>

          <div className="sheet-samples" role="group" aria-label="Sample melodies">
            <span className="sheet-samples-label">Or try a sample:</span>
            {BUILT_IN_SAMPLES.map((s) => (
              <button key={s.id} type="button" className="text-action" onClick={() => loadSample(s.id)}>{s.title}</button>
            ))}
            <a className="text-action" href="/fixtures/sheet-practice/c-major-scale.png" download="c-major-scale.png">Download test sheet (PNG)</a>
          </div>

          {omrMessage && <p className="sheet-omr-message">{omrMessage}</p>}
          {uploadPreview && (
            // User-uploaded blob preview; next/image does not apply to object URLs.
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview only
            <img src={uploadPreview} alt="Uploaded sheet preview" className="sheet-upload-preview" />
          )}

          {score && score.notes.length > 0 && (
            <div className="sheet-note-editor">
              <strong>Edit detected notes</strong>
              <ul>
                {score.notes.map((n, index) => (
                  <li key={`${index}-${n.name}`}>
                    <span>{index + 1}.</span>
                    <select value={n.name} onChange={(e) => updateNoteAt(index, e.target.value)} aria-label={`Note ${index + 1}`}>
                      {TREBLE_KEYS.map((key) => <option key={key} value={key}>{key}</option>)}
                    </select>
                    <button type="button" className="sheet-remove-note" onClick={() => removeNote(index)} aria-label={`Remove note ${index + 1}`}>×</button>
                  </li>
                ))}
              </ul>
              <button type="button" className="text-action" onClick={addNote}>+ Add note</button>
            </div>
          )}
        </div>

        <div className="music-card sheet-practice-card">
          <div className="music-card-top">
            <span>{score?.title ?? "Your melody"}</span>
            <small>Treble clef · {displayNotes.length} notes</small>
          </div>
          <Staff notes={displayNotes} clef="treble" />
          <p className="chord-formula">{displayNotes.length ? prettyNotes(displayNotes).join(" → ") : "Load or upload a melody to begin"}</p>
        </div>
      </div>

      <div className="answer-zone sheet-record-zone">
        <div className="answer-status" aria-live="polite">
          {recordPhase === "idle" && <span>{score?.notes.length ? "Ready when you are — tap Record and play." : "Choose a sample or upload a sheet first."}</span>}
          {recordPhase === "recording" && <span className="sheet-recording-pulse">● Recording… play each note, then tap Stop.</span>}
          {recordPhase === "analyzing" && <span>Analyzing your playing…</span>}
          {recordPhase === "done" && grade && <span className={grade === "pass" ? "correct" : grade === "partial" ? "try-again" : "try-again"}>{GRADE_COPY[grade]}</span>}
          {recordError && <span className="try-again">{recordError}</span>}
        </div>

        <div className="answer-actions">
          {recordPhase !== "recording" ? (
            <button
              type="button"
              className="check-button"
              disabled={!score?.notes.length || recordPhase === "analyzing"}
              onClick={() => void startRecording()}
            >
              {recordPhase === "analyzing" ? "Listening…" : "Record"}
            </button>
          ) : (
            <button type="button" className="check-button next" onClick={stopRecording}>Stop</button>
          )}
        </div>

        {summary && results && (
          <div className="sheet-results">
            <p><strong>{summary.correct} of {summary.total}</strong> notes matched.</p>
            {summary.missed.length > 0 && (
              <p>Keep practicing: {summary.missed.join(", ")}</p>
            )}
            <ol className="sheet-result-list">
              {results.map((r) => (
                <li key={r.index} className={r.ok ? "sheet-result-ok" : "sheet-result-miss"}>
                  {r.index + 1}. {r.expected}
                  {r.detectedMidi != null ? ` — heard ${midiToNote(Math.round(r.detectedMidi))}` : " — not heard"}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
