import type { AnalyticsRecord } from "./analytics";
import type { ErrorSource } from "./error-report";

const seenErrors = new Set<string>();

function postJson(path: string, body: string) {
  void fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

export function sendAnalytics(record: AnalyticsRecord) {
  const body = JSON.stringify(record);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const sent = navigator.sendBeacon("/api/analytics", new Blob([body], { type: "application/json" }));
    if (sent) return;
  }
  postJson("/api/analytics", body);
}

export function reportClientError(input: { message: string; stack?: string; source: ErrorSource; path: string }) {
  const key = `${input.source}:${input.message}`;
  if (seenErrors.has(key)) return;
  seenErrors.add(key);
  postJson("/api/errors", JSON.stringify(input));
}
