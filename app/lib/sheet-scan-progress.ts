export type SheetScanPhase = "loading" | "uploading" | "analyzing" | "merging" | "local";

export type SheetScanProgress = {
  page: number;
  pageCount: number;
  phase: SheetScanPhase;
};

export function sheetScanProgressValue(page: number, pageCount: number, phase: SheetScanPhase) {
  if (pageCount <= 0) return 0;
  if (phase === "merging") return 1;
  const slice = 1 / pageCount;
  const base = (page - 1) * slice;
  if (phase === "loading") return base + slice * 0.15;
  if (phase === "uploading") return base + slice * 0.45;
  if (phase === "local") return base + slice * 0.75;
  return base + slice * 0.92;
}

export function sheetScanProgressLabel(page: number, pageCount: number, phase: SheetScanPhase) {
  if (phase === "merging") return "Merging pages…";
  if (phase === "loading") return `Loading page ${page} of ${pageCount}…`;
  if (phase === "uploading") return `Sending page ${page} of ${pageCount} for enhanced read…`;
  if (phase === "local") return `On-device fallback for page ${page} of ${pageCount}…`;
  return `Reading page ${page} of ${pageCount}…`;
}
