import { recognizeWithGemini } from "./sheet-vision-gemini.ts";
import { recognizeWithOpenAI } from "./sheet-vision-openai.ts";
import type { SheetVisionRequest, SheetVisionResult } from "./sheet-vision-types.ts";

export type SheetVisionProviderId = "gemini" | "openai";

export function resolveSheetVisionProvider():
  | { provider: SheetVisionProviderId; apiKey: string }
  | null {
  const prefer = process.env.SHEET_VISION_PROVIDER?.trim().toLowerCase();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiKey = process.env.OPENAI_API_KEY?.trim();

  if (prefer === "openai" && openaiKey) return { provider: "openai", apiKey: openaiKey };
  if (prefer === "gemini" && geminiKey) return { provider: "gemini", apiKey: geminiKey };
  if (geminiKey) return { provider: "gemini", apiKey: geminiKey };
  if (openaiKey) return { provider: "openai", apiKey: openaiKey };
  return null;
}

export async function recognizeWithVisionProvider(
  request: SheetVisionRequest,
  resolved: { provider: SheetVisionProviderId; apiKey: string },
): Promise<SheetVisionResult> {
  if (resolved.provider === "gemini") {
    return recognizeWithGemini(request, resolved.apiKey);
  }
  return recognizeWithOpenAI(request, resolved.apiKey);
}
