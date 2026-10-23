import assert from "node:assert/strict";
import test from "node:test";
import { resolveSheetVisionProvider } from "../../app/lib/sheet-vision-provider.ts";

test("prefers Gemini when GEMINI_API_KEY is set", () => {
  const previousGemini = process.env.GEMINI_API_KEY;
  const previousOpenai = process.env.OPENAI_API_KEY;
  const previousPrefer = process.env.SHEET_VISION_PROVIDER;
  process.env.GEMINI_API_KEY = "gemini-test";
  process.env.OPENAI_API_KEY = "openai-test";
  delete process.env.SHEET_VISION_PROVIDER;
  assert.deepEqual(resolveSheetVisionProvider(), { provider: "gemini", apiKey: "gemini-test" });
  process.env.SHEET_VISION_PROVIDER = "openai";
  assert.deepEqual(resolveSheetVisionProvider(), { provider: "openai", apiKey: "openai-test" });
  if (previousGemini === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = previousGemini;
  if (previousOpenai === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousOpenai;
  if (previousPrefer === undefined) delete process.env.SHEET_VISION_PROVIDER;
  else process.env.SHEET_VISION_PROVIDER = previousPrefer;
});
