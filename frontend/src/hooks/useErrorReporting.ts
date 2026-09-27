/**
 * Error Reporting Hook
 *
 * Provides error reporting functionality without logging PII or sensitive data.
 * Safe for client-side use.
 */

"use client";

import { useCallback } from "react";
import { sanitizeError, type SanitizedError } from "@/lib/errors/types";

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
  const reportError = useCallback(
    (error: unknown, options?: ErrorReportOptions) => {
      // Sanitize error (removes PII and sensitive data)
      const sanitized = sanitizeError(error);

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

      // Log to console in development
      if (process.env.NODE_ENV === "development") {
        console.error("[Error Report]", report);
      }

      // In production, send to error tracking service
      if (process.env.NODE_ENV === "production") {
        sendToErrorTracking(report);
      }
    },
    [],
  );

  const clearErrors = useCallback(() => {
    // Clear any stored errors
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("tycoon_errors");
    }
  }, []);

  return {
    reportError,
    clearErrors,
    lastError: null,
    errorHistory: [],
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
 * Send error to tracking service
 * Replace with your actual error tracking implementation
 */
function sendToErrorTracking(report: {
  errorCode?: string;
  category: string;
  timestamp: string;
  component?: string;
  action?: string;
  context?: Record<string, string | number | boolean>;
  userAgent?: string;
  url?: string;
}) {
  // Example: Send to Sentry, Datadog, or custom endpoint
  // This is a placeholder - implement based on your error tracking service

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
