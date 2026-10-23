import assert from "node:assert/strict";
import test from "node:test";
import { sheetScanProgressLabel, sheetScanProgressValue } from "../../app/lib/sheet-scan-progress.ts";

test("scan progress advances per page and phase", () => {
  assert.ok(sheetScanProgressValue(1, 2, "loading") < sheetScanProgressValue(1, 2, "analyzing"));
  assert.ok(sheetScanProgressValue(1, 2, "analyzing") < sheetScanProgressValue(2, 2, "loading"));
  assert.equal(sheetScanProgressValue(2, 2, "merging"), 1);
});

test("scan progress labels name the current step", () => {
  assert.match(sheetScanProgressLabel(2, 3, "analyzing"), /page 2 of 3/i);
  assert.match(sheetScanProgressLabel(1, 1, "merging"), /merging/i);
});
