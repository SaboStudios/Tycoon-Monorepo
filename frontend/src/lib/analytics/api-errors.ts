import {
  ErrorCategory,
  getApiErrorCategoryFromUnknown,
  getHttpStatusErrorCategory,
} from "@/lib/errors";

/**
 * Analytics-safe error type strings for the `error_type` taxonomy field.
 * Kept intentionally short and non-PII — no stack traces, messages, or codes.
 */
export type AnalyticsErrorType =
  | "network_error"
  | "auth_error"
  | "validation"
  | "server_error"
  | "not_found"
  | "rate_limit"
  | "unknown";

const CATEGORY_TO_ANALYTICS_ERROR: Record<ErrorCategory, AnalyticsErrorType> = {
  [ErrorCategory.NETWORK]: "network_error",
  [ErrorCategory.AUTH]: "auth_error",
  [ErrorCategory.VALIDATION]: "validation",
  [ErrorCategory.SERVER]: "server_error",
  [ErrorCategory.NOT_FOUND]: "not_found",
  [ErrorCategory.RATE_LIMIT]: "rate_limit",
  [ErrorCategory.UNKNOWN]: "unknown",
};

/**
 * Maps any thrown value to an analytics-safe `error_type` string.
 *
 * Handles: TycoonApiError, plain objects with `code`/`status`/`statusCode`,
 * fetch Response objects, and generic Error instances.
 * Unrecognised errors resolve to `"unknown"` — never throws.
 */
export function getAnalyticsErrorType(error: unknown): AnalyticsErrorType {
  // Named API error code or status-code object
  const category = getApiErrorCategoryFromUnknown(error);
  if (category !== undefined) {
    return CATEGORY_TO_ANALYTICS_ERROR[category];
  }

  // fetch Response
  if (error instanceof Response) {
    return CATEGORY_TO_ANALYTICS_ERROR[getHttpStatusErrorCategory(error.status)];
  }

  // Generic Error — heuristic on message
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch") || msg.includes("connection")) {
      return "network_error";
    }
    if (msg.includes("auth") || msg.includes("unauthorized") || msg.includes("forbidden")) {
      return "auth_error";
    }
    if (msg.includes("validation") || msg.includes("invalid")) {
      return "validation";
    }
  }

  return "unknown";
}
