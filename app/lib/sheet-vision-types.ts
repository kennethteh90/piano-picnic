import type { ScannedEvent } from "./sheet-recognition.ts";

export const SHEET_VISION_MAX_BODY_BYTES = 600_000;
export const SHEET_VISION_MAX_IMAGE_BYTES = 450_000;

export type SheetVisionRequest = {
  image: string;
  mime: "image/jpeg" | "image/webp" | "image/png";
  pages?: number;
  turnstileToken?: string;
};

export type SheetVisionSuccess = {
  ok: true;
  events: ScannedEvent[];
  pages: number;
  source: "vision";
};

export type SheetVisionFailure = {
  ok: false;
  reason: string;
  status?: number;
};

export type SheetVisionResult = SheetVisionSuccess | SheetVisionFailure;
