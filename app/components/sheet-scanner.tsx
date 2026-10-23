"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { rasterFromImageFile, rasterFromVideoFrame } from "../lib/sheet-image";
import { mergeSheetPages, recognizeSheetFromImageData, type SheetRecognitionResult } from "../lib/sheet-recognition";

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

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

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
  }, [onResult]);

  const startCamera = useCallback(async () => {
    setMessage("Allow camera access, then line up the staff.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStatus("camera");
      setMessage("Hold the page steady. Frame both staves if you can.");
    } catch {
      setStatus("error");
      setMessage("Camera access is blocked. Check browser permissions or upload page photos instead.");
    }
  }, []);

  const captureFrame = useCallback(async (append: boolean) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    setStatus("scanning");
    setMessage("Reading the notes…");
    try {
      const image = await rasterFromVideoFrame(video);
      const result = recognizeSheetFromImageData(image);
      publishResult(result, append && hasScore, true);
    } catch {
      setStatus("error");
      setMessage("Could not read that image. Try another photo.");
    }
  }, [hasScore, publishResult]);

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
      const results: SheetRecognitionResult[] = [];
      for (const [index, file] of files.entries()) {
        setMessage(`Reading page ${index + 1} of ${files.length}…`);
        try {
          const image = await rasterFromImageFile(file);
          results.push(recognizeSheetFromImageData(image));
        } catch {
          results.push({ ok: false, reason: "Could not load that image." });
        }
      }
      const merged = mergeSheetPages(results);
      const shouldAppend = append && hasScore && merged.ok;
      publishResult(merged, shouldAppend, false);
      stopCamera();
    })();
  }, [hasScore, publishResult, stopCamera]);

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
        {status === "idle" || status === "error" ? (
          <div className="sheet-scanner__placeholder" aria-hidden="true">
            <span>📷</span>
            <p>Camera or page photos</p>
          </div>
        ) : (
          <video ref={videoRef} className="sheet-scanner__video" playsInline muted aria-label="Camera preview of sheet music" />
        )}
        <div className="sheet-scanner__guide" aria-hidden="true" />
      </div>
      <p className="sheet-scanner__message" role="status">{message}</p>
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
            <button type="button" className="primary-action" onClick={() => captureFrame(false)} disabled={busy || status === "scanning"}>
              <span aria-hidden="true">✦</span> {status === "scanning" ? "Reading…" : "Scan & play"}
            </button>
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
