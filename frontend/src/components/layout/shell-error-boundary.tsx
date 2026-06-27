"use client";

import React, { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ShellErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[ShellErrorBoundary] Uncaught render error:", error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return (
        <div
          role="alert"
          className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center"
          data-testid="shell-error-fallback"
        >
          <p className="text-sm text-[var(--tycoon-text-muted)]">
            Something went wrong. Please refresh the page.
          </p>
        </div>
      );
    }

    if (!this.props.children) {
      return (
        <div
          className="flex flex-1 flex-col items-center justify-center p-8 text-center"
          data-testid="shell-empty-state"
        >
          <p className="text-sm text-[var(--tycoon-text-muted)]">
            No content to display.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
