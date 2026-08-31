import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetErrorTrackingForTests,
  captureError,
  initErrorTracking,
  isErrorTrackingEnabled,
  scrubEventPii,
  type ErrorTrackingReport,
} from "./tracking";

const REPORT: ErrorTrackingReport = {
  errorCode: "BOOM",
  category: "unknown",
  timestamp: "2026-08-29T00:00:00.000Z",
  component: "Thing",
  action: "doStuff",
  context: { attempt: 1 },
  url: "https://app.example.com/thing",
};

afterEach(() => {
  __resetErrorTrackingForTests();
  vi.restoreAllMocks();
});

describe("isErrorTrackingEnabled", () => {
  it("is disabled in the test environment", () => {
    expect(isErrorTrackingEnabled()).toBe(false);
  });
});

describe("initErrorTracking", () => {
  it("resolves without loading the SDK when disabled", async () => {
    await expect(initErrorTracking()).resolves.toBeUndefined();
  });
});

describe("captureError", () => {
  it("returns false (no SDK) so the caller can fall back", () => {
    expect(captureError(new Error("nope"), REPORT)).toBe(false);
  });

  it("does not touch the network", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null));
    await initErrorTracking();
    captureError(new Error("nope"), REPORT);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("scrubEventPii", () => {
  it("drops the attached user", () => {
    const event = scrubEventPii({ user: { id: 7, email: "a@b.com" } });
    expect(event.user).toBeUndefined();
  });

  it("removes cookies, query string and body from the request", () => {
    const event = scrubEventPii({
      request: {
        url: "https://app.example.com/x?token=abc&id=9",
        cookies: "auth-token=abc",
        query_string: "token=abc",
        data: { password: "hunter2" },
        headers: { Authorization: "Bearer abc", "X-Trace": "ok" },
      },
    });
    expect(event.request?.cookies).toBeUndefined();
    expect(event.request?.query_string).toBeUndefined();
    expect(event.request?.data).toBeUndefined();
    expect(event.request?.url).toBe("https://app.example.com/x");
    expect(event.request?.headers).toEqual({
      Authorization: "[redacted]",
      "X-Trace": "ok",
    });
  });

  it("redacts sensitive keys in extra/contexts recursively", () => {
    const event = scrubEventPii({
      extra: { email: "a@b.com", nested: { apiKey: "k", safe: 1 } },
      contexts: { report: { jwt: "x", url: "/ok" } },
    });
    expect(event.extra).toEqual({
      email: "[redacted]",
      nested: { apiKey: "[redacted]", safe: 1 },
    });
    expect(event.contexts?.report).toEqual({ jwt: "[redacted]", url: "/ok" });
  });
});
