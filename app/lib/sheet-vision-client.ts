import type { SheetVisionResult } from "./sheet-vision-types.ts";

export type SheetVisionClientOptions = {
  mime: "image/jpeg" | "image/webp" | "image/png";
  base64: string;
  pages?: number;
  turnstileToken?: string;
};

export async function fetchSheetVision(options: SheetVisionClientOptions): Promise<SheetVisionResult> {
  const response = await fetch("/api/sheet-vision", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      image: options.base64,
      mime: options.mime,
      pages: options.pages,
      turnstileToken: options.turnstileToken,
    }),
  });

  const payload = await response.json() as SheetVisionResult;
  if (!response.ok && payload.ok === false) return payload;
  if (!response.ok) {
    return { ok: false, reason: "Enhanced read is unavailable right now." };
  }
  return payload;
}
