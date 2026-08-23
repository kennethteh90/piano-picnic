import assert from "node:assert/strict";
import test from "node:test";
import { safeRelativeReturnPath } from "../../app/lib/return-path.ts";

// The reserved auth routes the ChatGPT sign-in helpers protect.
const RESERVED = ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"];

test("keeps plain same-origin return paths, including query and hash", () => {
  assert.equal(safeRelativeReturnPath("/", RESERVED), "/");
  assert.equal(safeRelativeReturnPath("/practice", RESERVED), "/practice");
  assert.equal(safeRelativeReturnPath("/practice?round=2#top", RESERVED), "/practice?round=2#top");
});

test("collapses absolute and protocol-relative URLs to the home path", () => {
  for (const hostile of [
    "",
    "relative",
    "//evil.com/path",
    "https://evil.com/path",
    "http://evil.com",
    "/\\evil.com",
    "https:evil.com",
  ]) {
    assert.equal(safeRelativeReturnPath(hostile, RESERVED), "/", `expected "${hostile}" to be rejected`);
  }
});

test("never returns a reserved auth route", () => {
  for (const reserved of RESERVED) {
    assert.equal(safeRelativeReturnPath(reserved, RESERVED), "/");
    assert.equal(safeRelativeReturnPath(`${reserved}?x=1`, RESERVED), "/");
  }
});

test("reserved filtering follows exact pathname matches only", () => {
  assert.equal(safeRelativeReturnPath("/callbackish", RESERVED), "/callbackish");
  assert.equal(safeRelativeReturnPath("/callback", []), "/callback");
});

test("output is always a parseable same-origin relative URL", () => {
  for (const input of ["/a/b", "//x", "/%2e%2e", "/..", "/#", "?query"]) {
    const result = safeRelativeReturnPath(input, RESERVED);
    assert.ok(result.startsWith("/"), `"${input}" produced non-path ${result}`);
    if (result !== "/") {
      assert.equal(new URL(result, "https://app.local").origin, "https://app.local");
    }
  }
});
