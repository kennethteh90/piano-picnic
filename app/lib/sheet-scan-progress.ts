export type SheetScanPhase = "loading" | "analyzing" | "merging";

export function sheetScanProgressValue(page: number, pageCount: number, phase: SheetScanPhase) {
  if (pageCount <= 0) return 0;
  if (phase === "merging") return 1;
  const slice = 1 / pageCount;
  const base = (page - 1) * slice;
  if (phase === "loading") return base + slice * 0.2;
  return base + slice * 0.95;
}

export function sheetScanProgressLabel(page: number, pageCount: number, phase: SheetScanPhase) {
  if (phase === "merging") return "Merging pages…";
  if (phase === "loading") return `Loading page ${page} of ${pageCount}…`;
  return `Analyzing page ${page} of ${pageCount}…`;
}
