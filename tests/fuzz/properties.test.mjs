// Property-based fuzz tests. Each `fc.property` runs many generated inputs
// per assertion, so these act as lightweight fuzzers for the pure game logic.
import assert from "node:assert/strict";
import test from "node:test";
import fc from "fast-check";
import { sameNotes, shuffledIndices } from "../../app/lib/music-theory.ts";
import { safeRelativeReturnPath } from "../../app/lib/return-path.ts";

test("shuffledIndices always returns a permutation", () => {
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 64 }), (length) => {
      const result = shuffledIndices(length);
      assert.equal(result.length, length);
      assert.deepEqual([...result].sort((a, b) => a - b), Array.from({ length }, (_, index) => index));
    }),
  );
});

test("shuffledIndices never deals the avoided index first", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2, max: 64 }),
      fc.integer({ min: -5, max: 70 }),
      (length, avoidFirst) => {
        assert.notEqual(shuffledIndices(length, avoidFirst)[0], avoidFirst);
      },
    ),
  );
});

const HOSTILE_RETURN_PATHS = fc.oneof(
  fc.string(),
  fc.webUrl().map((url) => url),
  fc.webUrl().map((url) => new URL(url).pathname + new URL(url).search),
  fc.constantFrom("//evil.com", "/\\evil.com", "https:evil.com", "/..", "/%2e%2e", "/./../.."),
);

test("return paths stay same-origin relative under hostile input", () => {
  const RESERVED = ["/signin-with-chatgpt", "/signout-with-chatgpt", "/callback"];
  fc.assert(
    fc.property(HOSTILE_RETURN_PATHS, (input) => {
      const result = safeRelativeReturnPath(input, RESERVED);
      assert.ok(result.startsWith("/"), `not a path: ${JSON.stringify(result)}`);
      assert.ok(!result.startsWith("//"), `protocol-relative leak: ${JSON.stringify(result)}`);
      if (result !== "/") {
        const resolved = new URL(result, "https://app.local");
        assert.equal(resolved.origin, "https://app.local");
        assert.ok(!RESERVED.includes(resolved.pathname), `reserved route leaked: ${result}`);
      }
    }),
  );
});

test("sameNotes is order- and permutation-insensitive", () => {
  fc.assert(
    fc.property(
      fc.array(fc.constantFrom("C3", "E3", "G3", "B2", "F#3"), { maxLength: 8 }),
      fc.nat(7),
      (notes, shift) => {
        const rotated = [...notes.slice(shift), ...notes.slice(0, shift)];
        assert.equal(sameNotes(notes, rotated), true);
        assert.equal(sameNotes(notes, [...notes, "C3"]), false);
      },
    ),
  );
});

test("sameNotes behaves like multiset equality on arbitrary spellings", () => {
  fc.assert(
    fc.property(fc.array(fc.string({ minLength: 1, maxLength: 3 }), { maxLength: 12 }), (notes) => {
      assert.equal(sameNotes(notes, [...notes].reverse()), true);
    }),
  );
});
