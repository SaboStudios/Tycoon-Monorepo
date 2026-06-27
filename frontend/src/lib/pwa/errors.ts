import type { ApiErrorCode } from "@/lib/api/errors";

/** Subset of error conditions a PWA fetch handler can produce. */
export type PwaFetchErrorKind =
  | "offline"       // navigator.onLine === false or fetch threw TypeError
  | "timeout"       // AbortError from a timed-out SW fetch
  | "cache-miss"    // shell asset not in cache and network unavailable
  | "bad-response"; // non-ok HTTP response from the network

export interface PwaFetchError {
  kind: PwaFetchErrorKind;
  /** Mapped code compatible with the shared ApiErrorCode union. */
  code: ApiErrorCode;
  message: string;
  /** Original HTTP status when available (bad-response only). */
  statusCode: number;
}

const KIND_MAP: Record<PwaFetchErrorKind, { code: ApiErrorCode; statusCode: number; message: string }> = {
  offline:       { code: "NETWORK_ERROR",          statusCode: 0,   message: "You appear to be offline." },
  timeout:       { code: "TIMEOUT",                statusCode: 408, message: "The request timed out." },
  "cache-miss":  { code: "NETWORK_ERROR",          statusCode: 0,   message: "Resource unavailable offline." },
  "bad-response":{ code: "INTERNAL_SERVER_ERROR",  statusCode: 500, message: "Unexpected response from server." },
};

/**
 * Build a PwaFetchError from a known kind.
 * Pass `statusCode` to override the default for bad-response cases.
 */
export function makePwaFetchError(
  kind: PwaFetchErrorKind,
  statusCode?: number,
): PwaFetchError {
  const base = KIND_MAP[kind];
  return {
    kind,
    code: base.code,
    message: base.message,
    statusCode: statusCode ?? base.statusCode,
  };
}

/**
 * Classify a caught fetch error (TypeError / DOMException) into a PwaFetchErrorKind.
 * Handles stale, disconnected, and invalid states gracefully.
 */
export function classifyFetchError(err: unknown): PwaFetchErrorKind {
  if (err instanceof DOMException && err.name === "AbortError") return "timeout";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  if (err instanceof TypeError) return "offline"; // fetch() throws TypeError when network is gone
  return "offline"; // safe fallback — treat unknown network errors as offline
}

/** Returns true when the error should show an offline / retry UI. */
export function isPwaNetworkError(err: PwaFetchError): boolean {
  return err.kind === "offline" || err.kind === "cache-miss";
}
