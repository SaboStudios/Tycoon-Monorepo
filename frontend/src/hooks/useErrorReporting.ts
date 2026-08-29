/**
 * Error Reporting Hook
 *
 * Provides error reporting functionality without logging PII or sensitive data.
 * Safe for client-side use.
 */

"use client";

import { useCallback, useState } from "react";
import { sanitizeError, type SanitizedError } from "@/lib/errors/types";
import { captureError, type ErrorTrackingReport } from "@/lib/errors/tracking";

export interface ErrorReportOptions {
  /** Additional context (non-sensitive) */
  context?: Record<string, string | number | boolean>;
  /** Component name where error occurred */
  component?: string;
  /** Action user was performing */
  action?: string;
}

export interface UseErrorReportingReturn {
  /** Report an error */
  reportError: (error: unknown, options?: ErrorReportOptions) => void;
  /** Clear reported errors */
  clearErrors: () => void;
  /** Last reported error (sanitized) */
  lastError: SanitizedError | null;
  /** Error history (last 10 errors) */
  errorHistory: SanitizedError[];
}

/**
 * Hook for reporting errors without PII
 *
 * @example
 * ```tsx
 * const { reportError } = useErrorReporting();
 *
 * try {
 *   await fetchData();
 * } catch (error) {
 *   reportError(error, { component: 'UserProfile', action: 'fetch' });
 * }
 * ```
 */
export function useErrorReporting(): UseErrorReportingReturn {
  const [lastError, setLastError] = useState<SanitizedError | null>(null);
  const [errorHistory, setErrorHistory] = useState<SanitizedError[]>([]);

  const reportError = useCallback(
    (error: unknown, options?: ErrorReportOptions) => {
      // Sanitize error (removes PII and sensitive data)
      const sanitized = sanitizeError(error);

      setLastError(sanitized);
      setErrorHistory((prev) => [...prev.slice(-9), sanitized]);

      // Create safe report (no PII, tokens, or sensitive URLs)
      const report = {
        errorCode: sanitized.errorCode,
        category: sanitized.category,
        timestamp: new Date().toISOString(),
        component: options?.component,
        action: options?.action,
        context: sanitizeContext(options?.context),
        userAgent:
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        url:
          typeof window !== "undefined"
            ? sanitizeUrl(window.location.href)
            : undefined,
      };

      // Log to console outside production (includes test/dev)
      if (process.env.NODE_ENV !== "production") {
        console.error("[Error Report]", report);
      }

      // In production, send to error tracking service
      if (process.env.NODE_ENV === "production") {
        sendToErrorTracking(error, report);
      }
    },
    [],
  );

  const clearErrors = useCallback(() => {
    setLastError(null);
    setErrorHistory([]);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("tycoon_errors");
    }
  }, []);

  return {
    reportError,
    clearErrors,
    lastError,
    errorHistory,
  };
}

/**
 * Sanitize context data (remove any potential PII)
 */
function sanitizeContext(
  context?: Record<string, string | number | boolean>,
): Record<string, string | number | boolean> | undefined {
  if (!context) return undefined;

  const safeContext: Record<string, string | number | boolean> = {};
  const blockedKeys = [
    "email",
    "password",
    "token",
    "secret",
    "key",
    "auth",
    "user",
    "id",
  ];

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();
    // Skip any key that might contain sensitive data
    if (blockedKeys.some((blocked) => lowerKey.includes(blocked))) {
      continue;
    }
    safeContext[key] = value;
  }

  return safeContext;
}

/**
 * Sanitize URL (remove query params that might contain PII)
 */
function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Keep only pathname, remove query params and hash
    return urlObj.origin + urlObj.pathname;
  } catch {
    return "[invalid-url]";
  }
}

/**
 * Send a sanitized error report to the tracking backend.
 *
 * Primary path is the error-tracking SDK (`@sentry/browser`, configured via
 * `NEXT_PUBLIC_SENTRY_DSN` — see `lib/errors/tracking.ts`). When no DSN is set,
 * fall back to a plain POST to `NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT` if one is
 * configured. Both paths no-op when neither is configured, so tests never make
 * a network call.
 */
function sendToErrorTracking(error: unknown, report: ErrorTrackingReport) {
  if (captureError(error, report)) {
    return;
  }

  const endpoint = process.env.NEXT_PUBLIC_ERROR_TRACKING_ENDPOINT;

  if (endpoint) {
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => {
      // Silently fail - don't log errors about error logging
    });
  }
}
