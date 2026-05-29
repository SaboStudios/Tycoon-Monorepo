import type { ApiErrorCode } from "@/lib/api/errors";

/**
 * Error categories for user-friendly messaging.
 */
export enum ErrorCategory {
  /** Network-related errors (offline, timeout, server unreachable) */
  NETWORK = "network",
  /** Authentication/authorization errors */
  AUTH = "auth",
  /** Client-side validation errors */
  VALIDATION = "validation",
  /** Server errors (5xx) */
  SERVER = "server",
  /** Not found errors (404) */
  NOT_FOUND = "not_found",
  /** Rate limiting errors */
  RATE_LIMIT = "rate_limit",
  /** Unknown/unexpected errors */
  UNKNOWN = "unknown",
}

type ApiErrorLike = {
  code?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

export const API_ERROR_CATEGORY: Record<ApiErrorCode, ErrorCategory> = {
  UNAUTHORIZED: ErrorCategory.AUTH,
  FORBIDDEN: ErrorCategory.AUTH,
  NOT_FOUND: ErrorCategory.NOT_FOUND,
  VALIDATION_ERROR: ErrorCategory.VALIDATION,
  CONFLICT: ErrorCategory.VALIDATION,
  RATE_LIMIT: ErrorCategory.RATE_LIMIT,
  INTERNAL_SERVER_ERROR: ErrorCategory.SERVER,
  NETWORK_ERROR: ErrorCategory.NETWORK,
  TIMEOUT: ErrorCategory.NETWORK,
  UNKNOWN: ErrorCategory.UNKNOWN,
};

const HTTP_STATUS_CATEGORY: Record<number, ErrorCategory> = {
  400: ErrorCategory.VALIDATION,
  401: ErrorCategory.AUTH,
  403: ErrorCategory.AUTH,
  404: ErrorCategory.NOT_FOUND,
  409: ErrorCategory.VALIDATION,
  429: ErrorCategory.RATE_LIMIT,
};

export function getApiErrorCategory(code: ApiErrorCode): ErrorCategory {
  return API_ERROR_CATEGORY[code] ?? ErrorCategory.UNKNOWN;
}

export function getHttpStatusErrorCategory(status: number): ErrorCategory {
  return HTTP_STATUS_CATEGORY[status] ?? (
    status >= 500 ? ErrorCategory.SERVER : ErrorCategory.UNKNOWN
  );
}

export function getApiErrorCategoryFromUnknown(
  error: unknown,
): ErrorCategory | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }

  const maybeApiError = error as ApiErrorLike;

  if (
    typeof maybeApiError.code === "string" &&
    maybeApiError.code in API_ERROR_CATEGORY
  ) {
    return getApiErrorCategory(maybeApiError.code as ApiErrorCode);
  }

  const status =
    typeof maybeApiError.statusCode === "number"
      ? maybeApiError.statusCode
      : maybeApiError.status;

  return typeof status === "number"
    ? getHttpStatusErrorCategory(status)
    : undefined;
}
