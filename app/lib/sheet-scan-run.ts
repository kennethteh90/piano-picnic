import { rasterFromImageFile, rasterFromVideoFrame } from "./sheet-image.ts";
import { recognizeRasterWithVision } from "./sheet-scan-recognize.ts";
import { sheetScanProgressLabel, type SheetScanProgress } from "./sheet-scan-progress.ts";
import { mergeSheetPages, type SheetRecognitionResult } from "./sheet-recognition.ts";

export type { SheetScanProgress } from "./sheet-scan-progress.ts";

async function yieldToUi() {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export type SheetScanOptions = {
  preferLocal?: boolean;
};

export async function recognizeUploadedPages(
  files: File[],
  onProgress: (progress: SheetScanProgress) => void,
  options?: SheetScanOptions,
): Promise<SheetRecognitionResult[]> {
  const results: SheetRecognitionResult[] = [];
  for (const [index, file] of files.entries()) {
    const page = index + 1;
    onProgress({ page, pageCount: files.length, phase: "loading" });
    await yieldToUi();
    try {
      const image = await rasterFromImageFile(file);
      results.push(await recognizeRasterWithVision(image, page, files.length, onProgress, options));
    } catch {
      results.push({ ok: false, reason: "Could not load that image." });
    }
  }
  return results;
}

export async function recognizeCameraFrame(
  video: HTMLVideoElement,
  onProgress: (progress: SheetScanProgress) => void,
  options?: SheetScanOptions,
): Promise<SheetRecognitionResult> {
  onProgress({ page: 1, pageCount: 1, phase: "loading" });
  await yieldToUi();
  const image = await rasterFromVideoFrame(video);
  return recognizeRasterWithVision(image, 1, 1, onProgress, options);
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
