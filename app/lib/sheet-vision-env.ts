import { env } from "cloudflare:workers";

export type SheetVisionWorkerEnv = Cloudflare.Env & {
  SHEET_VISION_RATELIMIT?: KVNamespace;
};

export function sheetVisionRateLimitKv() {
  return (env as SheetVisionWorkerEnv).SHEET_VISION_RATELIMIT;
}
