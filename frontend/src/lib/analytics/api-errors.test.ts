import { describe, expect, it } from "vitest";
import { TycoonApiError } from "@/lib/api/errors";
import { getAnalyticsErrorType } from "./api-errors";

describe("getAnalyticsErrorType", () => {
  describe("TycoonApiError — named codes", () => {
    it.each([
      ["UNAUTHORIZED", "auth_error"],
      ["FORBIDDEN", "auth_error"],
      ["NOT_FOUND", "not_found"],
      ["VALIDATION_ERROR", "validation"],
      ["CONFLICT", "validation"],
      ["RATE_LIMIT", "rate_limit"],
      ["INTERNAL_SERVER_ERROR", "server_error"],
      ["NETWORK_ERROR", "network_error"],
      ["TIMEOUT", "network_error"],
      ["UNKNOWN", "unknown"],
    ] as const)("maps code %s → %s", (code, expected) => {
      const err = new TycoonApiError({ code, statusCode: 0, message: "test" });
      expect(getAnalyticsErrorType(err)).toBe(expected);
    });
  });

  describe("plain objects — stale / disconnected API payloads", () => {
    it("maps { code } objects", () => {
      expect(getAnalyticsErrorType({ code: "RATE_LIMIT" })).toBe("rate_limit");
      expect(getAnalyticsErrorType({ code: "NOT_FOUND" })).toBe("not_found");
    });

    it("maps { statusCode } objects", () => {
      expect(getAnalyticsErrorType({ statusCode: 401 })).toBe("auth_error");
      expect(getAnalyticsErrorType({ statusCode: 503 })).toBe("server_error");
      expect(getAnalyticsErrorType({ statusCode: 429 })).toBe("rate_limit");
    });

    it("maps { status } objects (e.g. axios-style)", () => {
      expect(getAnalyticsErrorType({ status: 404 })).toBe("not_found");
      expect(getAnalyticsErrorType({ status: 403 })).toBe("auth_error");
    });

    it("returns unknown for unrecognised codes instead of throwing", () => {
      expect(getAnalyticsErrorType({ code: "FUTURE_CODE" })).toBe("unknown");
      expect(getAnalyticsErrorType({ code: "ANOTHER_NEW_CODE_2099" })).toBe("unknown");
    });
  });

  describe("HTTP Response objects", () => {
    it("maps 5xx responses to server_error", () => {
      expect(getAnalyticsErrorType(new Response(null, { status: 500 }))).toBe("server_error");
      expect(getAnalyticsErrorType(new Response(null, { status: 503 }))).toBe("server_error");
    });

    it("maps 401/403 to auth_error", () => {
      expect(getAnalyticsErrorType(new Response(null, { status: 401 }))).toBe("auth_error");
      expect(getAnalyticsErrorType(new Response(null, { status: 403 }))).toBe("auth_error");
    });

    it("maps 429 to rate_limit", () => {
      expect(getAnalyticsErrorType(new Response(null, { status: 429 }))).toBe("rate_limit");
    });

    it("maps 404 to not_found", () => {
      expect(getAnalyticsErrorType(new Response(null, { status: 404 }))).toBe("not_found");
    });
  });

  describe("generic Error instances — message heuristics", () => {
    it("maps network-related messages", () => {
      expect(getAnalyticsErrorType(new Error("network timeout"))).toBe("network_error");
      expect(getAnalyticsErrorType(new Error("Failed to fetch"))).toBe("network_error");
      expect(getAnalyticsErrorType(new Error("connection refused"))).toBe("network_error");
    });

    it("maps auth-related messages", () => {
      expect(getAnalyticsErrorType(new Error("Unauthorized"))).toBe("auth_error");
      expect(getAnalyticsErrorType(new Error("Forbidden by auth middleware"))).toBe("auth_error");
    });

    it("maps validation-related messages", () => {
      expect(getAnalyticsErrorType(new Error("validation failed for field email"))).toBe("validation");
      expect(getAnalyticsErrorType(new Error("invalid input"))).toBe("validation");
    });

    it("falls back to unknown for unrecognised messages", () => {
      expect(getAnalyticsErrorType(new Error("something exploded"))).toBe("unknown");
    });
  });

  describe("invalid / null / disconnected states", () => {
    it("returns unknown for null", () => {
      expect(getAnalyticsErrorType(null)).toBe("unknown");
    });

    it("returns unknown for undefined", () => {
      expect(getAnalyticsErrorType(undefined)).toBe("unknown");
    });

    it("returns unknown for primitives", () => {
      expect(getAnalyticsErrorType(42)).toBe("unknown");
      expect(getAnalyticsErrorType("error")).toBe("unknown");
    });

    it("returns unknown for empty object", () => {
      expect(getAnalyticsErrorType({})).toBe("unknown");
    });

    it("never throws regardless of input", () => {
      const weirdValues = [null, undefined, 0, false, [], {}, Symbol("x"), () => {}];
      for (const val of weirdValues) {
        expect(() => getAnalyticsErrorType(val)).not.toThrow();
      }
    });
  });
});
