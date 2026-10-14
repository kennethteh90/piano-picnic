import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseAnalyticsPayload } from "../../app/lib/analytics.ts";
import { parseErrorPayload, sanitizeErrorText } from "../../app/lib/error-report.ts";
import { APP_VERSION, RELEASE_PATH } from "../../app/lib/version.ts";

test("the release version matches package.json and RELEASES.md", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8"));
  const releases = readFileSync(new URL("../../RELEASES.md", import.meta.url), "utf8");
  assert.equal(APP_VERSION, "1.0.0");
  assert.equal(packageJson.version, APP_VERSION);
  assert.equal(RELEASE_PATH, "/v1");
  assert.match(releases, new RegExp(`## ${APP_VERSION}`));
  assert.match(releases, /\/v1/);
});

test("analytics keeps an allow-list and drops unexpected fields", () => {
  const parsed = parseAnalyticsPayload({
    event: "answer_checked",
    mode: "hear",
    difficulty: "explorer",
    correct: false,
    shortcut: "check",
    path: "/v1",
    email: "player@example.com",
    notes: ["C3"],
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.record, {
    event: "answer_checked",
    mode: "hear",
    difficulty: "explorer",
    correct: false,
    shortcut: "check",
    path: "/v1",
  });
});

test("analytics rejects unknown events, modes, and unsafe paths", () => {
  assert.equal(parseAnalyticsPayload(null).ok, false);
  assert.equal(parseAnalyticsPayload([]).ok, false);
  assert.equal(parseAnalyticsPayload({ event: "keystroke" }).ok, false);
  assert.equal(parseAnalyticsPayload({ event: "page_view", mode: "hard" }).ok, false);
  assert.equal(parseAnalyticsPayload({ event: "page_view", difficulty: "easy" }).ok, false);
  assert.equal(parseAnalyticsPayload({ event: "answer_checked", correct: "yes" }).ok, false);
  assert.equal(parseAnalyticsPayload({ event: "shortcut_used", shortcut: "undo" }).ok, false);
  assert.equal(parseAnalyticsPayload({ event: "page_view", path: "https://evil.test/v1" }).ok, false);
  assert.equal(parseAnalyticsPayload({ event: "page_view", path: "/v1?email=a@b.c" }).ok, false);
  const longPath = `/${"a".repeat(200)}`;
  assert.equal(parseAnalyticsPayload({ event: "page_view", path: longPath }).ok, false);
});

test("error reports redact emails and urls and cap length", () => {
  const sanitized = sanitizeErrorText("failed for pianist@example.com at https://secret.example/path", 500);
  assert.equal(sanitized.includes("pianist@example.com"), false);
  assert.equal(sanitized.includes("https://"), false);
  assert.match(sanitized, /\[redacted-email\]/);
  assert.match(sanitized, /\[redacted-url\]/);
  assert.equal(sanitizeErrorText("abcdef", 3), "abc");
});

test("error reports require a message, source, and safe path", () => {
  const parsed = parseErrorPayload({
    message: "  piano failed for kid@example.com  ",
    stack: "Error\nhttps://cdn.example/app.js",
    source: "boundary",
    path: "/v1",
    token: "secret",
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.record.message.includes("@"), false);
  assert.equal(parsed.record.stack?.includes("https://"), false);
  assert.equal("token" in parsed.record, false);
  assert.deepEqual(
    { source: parsed.record.source, path: parsed.record.path },
    { source: "boundary", path: "/v1" },
  );

  assert.equal(parseErrorPayload({ message: "   ", source: "window", path: "/v1" }).ok, false);
  assert.equal(parseErrorPayload({ message: "x", source: "console", path: "/v1" }).ok, false);
  assert.equal(parseErrorPayload({ message: "x", source: "window", path: "http://x" }).ok, false);
  assert.equal(parseErrorPayload({ message: "x", source: "window", path: "/v1", stack: 12 }).ok, false);
});
