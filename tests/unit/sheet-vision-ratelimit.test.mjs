import assert from "node:assert/strict";
import test from "node:test";
import { consumeSheetVisionRateLimit, rateLimitKey } from "../../app/lib/sheet-vision-ratelimit.ts";

function mockKv() {
  const store = new Map();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
  };
}

test("rate limit allows up to the hourly cap per IP", async () => {
  const kv = mockKv();
  const request = new Request("https://piano.codingagents.cc/api/sheet-vision", {
    headers: { "cf-connecting-ip": "203.0.113.10" },
  });
  for (let index = 0; index < 50; index += 1) {
    const result = await consumeSheetVisionRateLimit(kv, request, 50);
    assert.equal(result.ok, true);
  }
  const blocked = await consumeSheetVisionRateLimit(kv, request, 50);
  assert.equal(blocked.ok, false);
  assert.ok(blocked.retryAfterSeconds > 0);
});

test("rate limit keys are per IP and hour bucket", () => {
  assert.equal(rateLimitKey("1.2.3.4", 100), "vision:1.2.3.4:100");
});
