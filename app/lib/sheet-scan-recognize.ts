import { fetchSheetVision } from "./sheet-vision-client.ts";
import { rasterToJpegBase64 } from "./sheet-image.ts";
import { recognizeSheetFromImageData, type RasterImage, type SheetRecognitionResult } from "./sheet-recognition.ts";
import type { SheetScanProgress } from "./sheet-scan-progress.ts";

type ProgressFn = (progress: SheetScanProgress) => void;

async function yieldToUi() {
  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

export async function recognizeRasterWithVision(
  image: RasterImage,
  page: number,
  pageCount: number,
  onProgress: ProgressFn,
  options?: { preferLocal?: boolean },
): Promise<SheetRecognitionResult> {
  if (options?.preferLocal) {
    onProgress({ page, pageCount, phase: "local" });
    await yieldToUi();
    return recognizeSheetFromImageData(image);
  }

  onProgress({ page, pageCount, phase: "uploading" });
  await yieldToUi();
  try {
    const encoded = await rasterToJpegBase64(image);
    onProgress({ page, pageCount, phase: "analyzing" });
    await yieldToUi();
    const vision = await fetchSheetVision({
      base64: encoded.base64,
      mime: encoded.mime,
      pages: pageCount,
    });
    if (vision.ok) {
      return { ok: true, events: vision.events, pages: vision.pages ?? 1 };
    }
    if (vision.status !== 429) {
      onProgress({ page, pageCount, phase: "local" });
      await yieldToUi();
      return recognizeSheetFromImageData(image);
    }
    return { ok: false, reason: vision.reason };
  } catch {
    onProgress({ page, pageCount, phase: "local" });
    await yieldToUi();
    return recognizeSheetFromImageData(image);
  }
}
