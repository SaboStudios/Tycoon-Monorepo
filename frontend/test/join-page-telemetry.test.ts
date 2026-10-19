/**
 * Join page telemetry — consent gate and room-code scrubbing.
 * Covers frontend/app/join/page.tsx's track() helper:
 * - no-op when telemetry consent has not been granted
 * - fires the provider when consent is granted
 * - scrubs roomCode / code props so no PII reaches analytics
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { track } from "../app/join/page";

declare global {
  interface Window {
    tycoonAnalytics?: { track?: (e: string, p: Record<string, string | number>) => void };
  }
}

describe("join page track()", () => {
  let trackSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    trackSpy = vi.fn();
    window.tycoonAnalytics = { track: trackSpy };
    window.localStorage.clear();
  });

  afterEach(() => {
    delete window.tycoonAnalytics;
    window.localStorage.clear();
  });

  it("does not call the analytics provider when consent is missing", () => {
    track("join_room_submit");
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("does not call the analytics provider when consent is explicitly denied", () => {
    window.localStorage.setItem("tycoon.telemetry.consent", "denied");
    track("join_room_submit");
    expect(trackSpy).not.toHaveBeenCalled();
  });

  it("calls the analytics provider when consent is granted", () => {
    window.localStorage.setItem("tycoon.telemetry.consent", "granted");
    track("join_room_success");
    expect(trackSpy).toHaveBeenCalledWith("join_room_success", {});
  });

  it("scrubs roomCode from the event props", () => {
    window.localStorage.setItem("tycoon.telemetry.consent", "granted");
    track("join_room_error", { reason: "not_found", roomCode: "ABCD1234" });
    expect(trackSpy).toHaveBeenCalledWith("join_room_error", { reason: "not_found" });
  });

  it("scrubs code from the event props", () => {
    window.localStorage.setItem("tycoon.telemetry.consent", "granted");
    track("join_room_error", { reason: "not_found", code: "WXYZ" });
    expect(trackSpy).toHaveBeenCalledWith("join_room_error", { reason: "not_found" });
  });

  it("is a no-op when no analytics provider is attached, even with consent", () => {
    window.localStorage.setItem("tycoon.telemetry.consent", "granted");
    delete window.tycoonAnalytics;
    expect(() => track("join_room_submit")).not.toThrow();
  });
});
