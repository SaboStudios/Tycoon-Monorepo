import { describe, expect, it } from "vitest";
import { TycoonApiError } from "@/lib/api/errors";
import {
  API_ERROR_CATEGORY,
  ErrorCategory,
  categorizeError,
  getApiErrorCategory,
  getApiErrorCategoryFromUnknown,
  getHttpStatusErrorCategory,
  isNetworkError,
  isRecoverableError,
  isServerError,
  sanitizeError,
} from ".";
import type { ApiErrorCode } from "@/lib/api/errors";

const ALL_CODES: ApiErrorCode[] = [
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "CONFLICT",
  "RATE_LIMIT",
  "INTERNAL_SERVER_ERROR",
  "NETWORK_ERROR",
  "TIMEOUT",
  "UNKNOWN",
];

describe("API error category mapping", () => {
  it("has a category for every ApiErrorCode", () => {
    for (const code of ALL_CODES) {
      expect(API_ERROR_CATEGORY[code]).toBeDefined();
    }
  });

  it.each([
    ["UNAUTHORIZED", ErrorCategory.AUTH],
    ["FORBIDDEN", ErrorCategory.AUTH],
    ["NOT_FOUND", ErrorCategory.NOT_FOUND],
    ["VALIDATION_ERROR", ErrorCategory.VALIDATION],
    ["CONFLICT", ErrorCategory.VALIDATION],
    ["RATE_LIMIT", ErrorCategory.RATE_LIMIT],
    ["INTERNAL_SERVER_ERROR", ErrorCategory.SERVER],
    ["NETWORK_ERROR", ErrorCategory.NETWORK],
    ["TIMEOUT", ErrorCategory.NETWORK],
    ["UNKNOWN", ErrorCategory.UNKNOWN],
  ] satisfies Array<[ApiErrorCode, ErrorCategory]>)(
    "maps API code %s to category %s",
    (code, category) => {
      expect(getApiErrorCategory(code)).toBe(category);
    },
  );

  it.each([
    [400, ErrorCategory.VALIDATION],
    [401, ErrorCategory.AUTH],
    [403, ErrorCategory.AUTH],
    [404, ErrorCategory.NOT_FOUND],
    [409, ErrorCategory.VALIDATION],
    [429, ErrorCategory.RATE_LIMIT],
    [500, ErrorCategory.SERVER],
    [503, ErrorCategory.SERVER],
    [418, ErrorCategory.UNKNOWN],
  ])("maps HTTP status %i to category %s", (status, category) => {
    expect(getHttpStatusErrorCategory(status)).toBe(category);
  });

  it("recognizes TycoonApiError codes before falling back to message heuristics", () => {
    const err = new TycoonApiError({
      code: "TIMEOUT",
      statusCode: 408,
      message: "Request exceeded the budget",
    });

    expect(categorizeError(err)).toBe(ErrorCategory.NETWORK);
    expect(isNetworkError(err)).toBe(true);
  });

  it("recognizes plain API error payloads from stale or disconnected flows", () => {
    expect(getApiErrorCategoryFromUnknown({ code: "RATE_LIMIT" })).toBe(
      ErrorCategory.RATE_LIMIT,
    );
    expect(getApiErrorCategoryFromUnknown({ statusCode: 503 })).toBe(
      ErrorCategory.SERVER,
    );
    expect(getApiErrorCategoryFromUnknown({ status: 401 })).toBe(
      ErrorCategory.AUTH,
    );
  });

  it("keeps invalid states as unknown instead of throwing", () => {
    expect(getApiErrorCategoryFromUnknown(null)).toBeUndefined();
    expect(getApiErrorCategoryFromUnknown({
      code: "FUTURE_CODE",
    })).toBeUndefined();
    expect(() => sanitizeError({ code: "FUTURE_CODE" })).not.toThrow();
    expect(categorizeError({ code: "FUTURE_CODE" })).toBe(ErrorCategory.UNKNOWN);
  });

  it("keeps recoverability helpers aligned with API categories", () => {
    expect(isServerError(
      new TycoonApiError({
        code: "INTERNAL_SERVER_ERROR",
        statusCode: 500,
        message: "server",
      }),
    )).toBe(true);
    expect(isRecoverableError(
      new TycoonApiError({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "missing",
      }),
    )).toBe(false);
  });
});
