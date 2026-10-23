import assert from "node:assert/strict";
import test from "node:test";
import { parseVisionModelPayload, parseVisionRequestBody } from "../../app/lib/sheet-vision-parse.ts";

test("parses a valid vision request body", () => {
  const parsed = parseVisionRequestBody({ image: "aGVsbG8=", mime: "image/jpeg", pages: 2 }, 100);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.request.pages, 2);
});

test("parses model JSON into scanned events", () => {
  const parsed = parseVisionModelPayload({
    events: [
      { treble: [{ note: "E4", staccato: true }], bass: [{ note: "C3" }] },
      { treble: [{ note: "F4" }], bass: [] },
    ],
  });
  assert.equal(parsed.ok, true);
  assert.equal(parsed.events.length, 2);
  assert.equal(parsed.events[0].treble[0]?.staccato, true);
});
