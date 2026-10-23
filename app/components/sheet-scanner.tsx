"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sheetScanProgressValue } from "../lib/sheet-scan-progress";
import { mergePageResults, progressMessage, recognizeCameraFrame, recognizeUploadedPages, type SheetScanProgress } from "../lib/sheet-scan-run";
import type { SheetRecognitionResult } from "../lib/sheet-recognition";

type ScannerStatus = "idle" | "camera" | "scanning" | "error";

type SheetScannerProps = {
  onResult: (result: SheetRecognitionResult, options?: { append?: boolean }) => void;
  busy?: boolean;
  hasScore?: boolean;
};

export function SheetScanner({ onResult, busy = false, hasScore = false }: SheetScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [message, setMessage] = useState("Use the camera or upload page photos in order (page 1, then page 2).");
  const [scanProgress, setScanProgress] = useState<SheetScanProgress | null>(null);
  const [preferLocalScan, setPreferLocalScan] = useState(false);

  const applyProgress = useCallback((progress: SheetScanProgress) => {
    setScanProgress(progress);
    setMessage(progressMessage(progress));
  }, []);

  const clearProgress = useCallback(() => setScanProgress(null), []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const attachCameraStream = useCallback(async () => {
    const stream = streamRef.current;
    const video = videoRef.current;
    if (!stream || !video) return false;
    if (video.srcObject !== stream) video.srcObject = stream;

    const waitForFrame = () =>
      new Promise<boolean>((resolve) => {
        if (video.videoWidth > 0) {
          resolve(true);
          return;
        }
        const onReady = () => {
          video.removeEventListener("loadeddata", onReady);
          resolve(video.videoWidth > 0);
        };
        video.addEventListener("loadeddata", onReady);
        window.setTimeout(() => {
          video.removeEventListener("loadeddata", onReady);
          resolve(video.videoWidth > 0);
        }, 2500);
      });

    try {
      await video.play();
      return await waitForFrame();
    } catch {
      return false;
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const previewLive = status === "camera" || status === "scanning";

  useLayoutEffect(() => {
    if (!previewLive || !streamRef.current) return;
    void attachCameraStream();
  }, [attachCameraStream, previewLive]);

  const publishResult = useCallback((result: SheetRecognitionResult, append = false, keepCamera = false) => {
    onResult(result, { append });
    if (!result.ok) {
      setMessage(result.reason);
      setStatus("error");
      return;
    }
    const pages = result.pages ?? 1;
    const warning = result.warnings?.length ? ` ${result.warnings.length} page(s) skipped.` : "";
    setMessage(
      append
        ? `Added ${pages} page${pages === 1 ? "" : "s"} (${result.events.length} new chord${result.events.length === 1 ? "" : "s"}).${warning}`
        : `Read ${pages} page${pages === 1 ? "" : "s"} · ${result.events.length} chord${result.events.length === 1 ? "" : "s"} in order.${warning}`,
    );
    setStatus(keepCamera ? "camera" : "idle");
    clearProgress();
  }, [clearProgress, onResult]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setMessage("This browser cannot use the camera here. Try Upload pages instead.");
      return;
    }
    setMessage("Allow camera access, then line up the staff.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setStatus("camera");
      setMessage("Hold the page steady. Frame both staves if you can.");
    } catch {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStatus("error");
      setMessage("Camera access is blocked. Check browser permissions or upload page photos instead.");
    }
  }, []);

  const captureFrame = useCallback(async (append: boolean) => {
    const video = videoRef.current;
    if (!video || !streamRef.current) {
      setStatus("error");
      setMessage("Camera is not ready. Close and open the camera again.");
      return;
    }
    if (video.videoWidth === 0) {
      const ready = await attachCameraStream();
      if (!ready || video.videoWidth === 0) {
        setStatus("error");
        setMessage("Camera preview is still starting. Wait a moment, then try Scan & play again.");
        return;
      }
    }
    setStatus("scanning");
    try {
      const result = await recognizeCameraFrame(video, applyProgress, { preferLocal: preferLocalScan });
      publishResult(result, append && hasScore, true);
    } catch {
      clearProgress();
      setStatus("error");
      setMessage("Could not read that image. Try another photo.");
    }
  }, [applyProgress, attachCameraStream, clearProgress, hasScore, preferLocalScan, publishResult]);

  const handleFiles = useCallback((fileList: FileList | null, append: boolean) => {
    if (!fileList || fileList.length === 0) return;
    const files = [...fileList].filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      setStatus("error");
      setMessage("Choose JPG, PNG, or another image format.");
      return;
    }

    void (async () => {
      setStatus("scanning");
      try {
        const results = await recognizeUploadedPages(files, applyProgress, { preferLocal: preferLocalScan });
        const merged = await mergePageResults(results, applyProgress);
        const shouldAppend = append && hasScore && merged.ok;
        publishResult(merged, shouldAppend, false);
        stopCamera();
      } catch {
        clearProgress();
        setStatus("error");
        setMessage("Could not read those images. Try again.");
      }
    })();
  }, [applyProgress, clearProgress, hasScore, preferLocalScan, publishResult, stopCamera]);

  return (
    <div className="sheet-scanner">
      <input
        ref={fileInputRef}
        className="sheet-scanner__file-input"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files, false);
          event.target.value = "";
        }}
      />
      <input
        className="sheet-scanner__file-input"
        id="sheet-scanner-append"
        type="file"
        accept="image/*"
        multiple
        onChange={(event) => {
          handleFiles(event.target.files, true);
          event.target.value = "";
        }}
      />

      <div className="sheet-scanner__preview">
        <video
          ref={videoRef}
          className="sheet-scanner__video"
          playsInline
          muted
          autoPlay
          aria-hidden={!previewLive}
          aria-label="Camera preview of sheet music"
        />
        {!previewLive ? (
          <div className="sheet-scanner__placeholder" aria-hidden="true">
            <span>📷</span>
            <p>Camera or page photos</p>
          </div>
        ) : null}
        {previewLive ? <div className="sheet-scanner__guide" aria-hidden="true" /> : null}
        {previewLive && status === "camera" && (
          <div className="sheet-scanner__capture-bar">
            <button
              type="button"
              className="sheet-scanner__shutter"
              disabled={busy}
              aria-label="Take photo and play"
              onClick={() => captureFrame(false)}
            />
            <span className="sheet-scanner__capture-hint">Take photo</span>
          </div>
        )}
      </div>
      <label className="sheet-scanner__privacy">
        <input
          type="checkbox"
          checked={preferLocalScan}
          onChange={(event) => setPreferLocalScan(event.target.checked)}
          disabled={status === "scanning"}
        />
        <span>On-device scan only (image stays on your phone)</span>
      </label>
      <p className="sheet-scanner__message" role="status">{message}</p>
      {status === "scanning" && scanProgress && (
        <progress
          className="sheet-scanner__progress-bar"
          aria-label={message}
          max={100}
          value={Math.round(sheetScanProgressValue(scanProgress.page, scanProgress.pageCount, scanProgress.phase) * 100)}
        />
      )}
      <div className="sheet-scanner__actions">
        {status === "idle" || status === "error" ? (
          <>
            <button type="button" className="primary-action" onClick={() => void startCamera()} disabled={busy}>
              <span aria-hidden="true">📷</span> Open camera
            </button>
            <button type="button" className="text-action" onClick={() => fileInputRef.current?.click()} disabled={busy}>
              {hasScore ? "Replace with upload" : "Upload pages"}
            </button>
            {hasScore && (
              <button type="button" className="text-action" onClick={() => document.getElementById("sheet-scanner-append")?.click()} disabled={busy}>
                Add pages
              </button>
            )}
          </>
        ) : (
          <>
            {status !== "camera" && (
              <button type="button" className="primary-action" onClick={() => captureFrame(false)} disabled={busy || status === "scanning"}>
                <span aria-hidden="true">✦</span> {status === "scanning" ? "Reading…" : "Capture & play"}
              </button>
            )}
            {hasScore && (
              <button type="button" className="text-action" onClick={() => captureFrame(true)} disabled={busy || status === "scanning"}>
                Add page <span>+</span>
              </button>
            )}
            <button type="button" className="text-action" onClick={() => fileInputRef.current?.click()} disabled={busy || status === "scanning"}>
              Upload pages
            </button>
            {hasScore && (
              <button type="button" className="text-action" onClick={() => document.getElementById("sheet-scanner-append")?.click()} disabled={busy || status === "scanning"}>
                Append upload
              </button>
            )}
            <button
              type="button"
              className="text-action"
              onClick={() => { stopCamera(); setStatus("idle"); setMessage("Use the camera or upload page photos in order (page 1, then page 2)."); }}
              disabled={busy}
            >
              Close camera
            </button>
          </>
        )}
      </div>
    </div>
  );
}
