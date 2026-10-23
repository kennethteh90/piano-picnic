import { rasterFromImageFile, rasterFromVideoFrame } from "./sheet-image.ts";
import { sheetScanProgressLabel, type SheetScanPhase } from "./sheet-scan-progress.ts";
import { mergeSheetPages, recognizeSheetFromImageData, type SheetRecognitionResult } from "./sheet-recognition.ts";

export type SheetScanProgress = {
  page: number;
  pageCount: number;
  phase: SheetScanPhase;
};

async function yieldToUi() {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export async function recognizeUploadedPages(
  files: File[],
  onProgress: (progress: SheetScanProgress) => void,
): Promise<SheetRecognitionResult[]> {
  const results: SheetRecognitionResult[] = [];
  for (const [index, file] of files.entries()) {
    const page = index + 1;
    onProgress({ page, pageCount: files.length, phase: "loading" });
    await yieldToUi();
    try {
      const image = await rasterFromImageFile(file);
      onProgress({ page, pageCount: files.length, phase: "analyzing" });
      await yieldToUi();
      results.push(recognizeSheetFromImageData(image));
    } catch {
      results.push({ ok: false, reason: "Could not load that image." });
    }
  }
  return results;
}

export async function recognizeCameraFrame(
  video: HTMLVideoElement,
  onProgress: (progress: SheetScanProgress) => void,
): Promise<SheetRecognitionResult> {
  onProgress({ page: 1, pageCount: 1, phase: "loading" });
  await yieldToUi();
  const image = await rasterFromVideoFrame(video);
  onProgress({ page: 1, pageCount: 1, phase: "analyzing" });
  await yieldToUi();
  return recognizeSheetFromImageData(image);
}

export async function mergePageResults(
  results: SheetRecognitionResult[],
  onProgress: (progress: SheetScanProgress) => void,
) {
  onProgress({ page: results.length, pageCount: results.length, phase: "merging" });
  await yieldToUi();
  return mergeSheetPages(results);
}

export function progressMessage(progress: SheetScanProgress) {
  return sheetScanProgressLabel(progress.page, progress.pageCount, progress.phase);
}
