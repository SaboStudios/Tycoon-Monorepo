import { describe, expect, it, vi, afterEach } from "vitest";
import {
  classifyFetchError,
  isPwaNetworkError,
  makePwaFetchError,
} from "./errors";

afterEach(() => vi.restoreAllMocks());

describe("makePwaFetchError", () => {
  it("maps offline to NETWORK_ERROR with statusCode 0", () => {
    const err = makePwaFetchError("offline");
    expect(err.code).toBe("NETWORK_ERROR");
    expect(err.statusCode).toBe(0);
    expect(err.kind).toBe("offline");
  });

  it("maps timeout to TIMEOUT with statusCode 408", () => {
    const err = makePwaFetchError("timeout");
    expect(err.code).toBe("TIMEOUT");
    expect(err.statusCode).toBe(408);
  });

  it("maps cache-miss to NETWORK_ERROR", () => {
    const err = makePwaFetchError("cache-miss");
    expect(err.code).toBe("NETWORK_ERROR");
  });

  it("maps bad-response to INTERNAL_SERVER_ERROR", () => {
    const err = makePwaFetchError("bad-response");
    expect(err.code).toBe("INTERNAL_SERVER_ERROR");
    expect(err.statusCode).toBe(500);
  });

  it("overrides statusCode for bad-response", () => {
    const err = makePwaFetchError("bad-response", 503);
    expect(err.statusCode).toBe(503);
  });
});

describe("classifyFetchError", () => {
  it("classifies AbortError as timeout", () => {
    const abort = new DOMException("aborted", "AbortError");
    expect(classifyFetchError(abort)).toBe("timeout");
  });

  it("classifies TypeError as offline", () => {
    expect(classifyFetchError(new TypeError("Failed to fetch"))).toBe("offline");
  });

  it("classifies unknown errors as offline (safe fallback)", () => {
    expect(classifyFetchError(new Error("something weird"))).toBe("offline");
  });

  it("classifies error as offline when navigator.onLine is false", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    expect(classifyFetchError(new Error("any"))).toBe("offline");
  });
});

describe("isPwaNetworkError", () => {
  it("returns true for offline", () => {
    expect(isPwaNetworkError(makePwaFetchError("offline"))).toBe(true);
  });

  it("returns true for cache-miss", () => {
    expect(isPwaNetworkError(makePwaFetchError("cache-miss"))).toBe(true);
  });

  it("returns false for timeout", () => {
    expect(isPwaNetworkError(makePwaFetchError("timeout"))).toBe(false);
  });

  it("returns false for bad-response", () => {
    expect(isPwaNetworkError(makePwaFetchError("bad-response"))).toBe(false);
  });
});
