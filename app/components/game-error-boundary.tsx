"use client";

import { Component, type ReactNode } from "react";
import { reportClientError } from "../lib/browser-report";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class GameErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    reportClientError({
      message: error.message || "Render error",
      stack: error.stack,
      source: "boundary",
      path: window.location.pathname,
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="game-error">
        <h1>The piano hit a wrong note.</h1>
        <p>Refresh the page and try the song again.</p>
        <button type="button" onClick={() => window.location.reload()}>Refresh</button>
      </main>
    );
  }
}
