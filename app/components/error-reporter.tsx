"use client";

import { useEffect } from "react";
import { reportClientError } from "../lib/browser-report";

export function ErrorReporter() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      const error = event.error;
      reportClientError({
        message: event.message || "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
        source: "window",
        path: window.location.pathname,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      reportClientError({
        message: reason instanceof Error ? reason.message : "Unhandled rejection",
        stack: reason instanceof Error ? reason.stack : undefined,
        source: "unhandledrejection",
        path: window.location.pathname,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
