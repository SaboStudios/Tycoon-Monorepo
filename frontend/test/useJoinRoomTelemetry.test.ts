/**
 * SW-FE-039 — useJoinRoomTelemetry unit tests
 * Verifies privacy-safe telemetry hooks for the Join Room flow.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { track } from "@/lib/analytics";
import { useJoinRoomTelemetry } from "@/hooks/useJoinRoomTelemetry";

const mockTrack = vi.mocked(track);

beforeEach(() => mockTrack.mockClear());

describe("useJoinRoomTelemetry", () => {
  describe("trackFormViewed", () => {
    it("emits join_room_form_viewed with default source", () => {
      const { result } = renderHook(() => useJoinRoomTelemetry());
      act(() => result.current.trackFormViewed());
      expect(mockTrack).toHaveBeenCalledWith("join_room_form_viewed", {
        route: "/join-room",
        source: "page_load",
      });
    });

    it("accepts a custom source", () => {
      const { result } = renderHook(() => useJoinRoomTelemetry());
      act(() => result.current.trackFormViewed("modal"));
      expect(mockTrack).toHaveBeenCalledWith("join_room_form_viewed", {
        route: "/join-room",
        source: "modal",
      });
    });

    it("uses the route passed to the hook", () => {
      const { result } = renderHook(() => useJoinRoomTelemetry("/game/join"));
      act(() => result.current.trackFormViewed());
      expect(mockTrack).toHaveBeenCalledWith(
        "join_room_form_viewed",
        expect.objectContaining({ route: "/game/join" }),
      );
    });
  });

  describe("trackJoinAttempted", () => {
    it("emits join_room_attempted with default source", () => {
      const { result } = renderHook(() => useJoinRoomTelemetry());
      act(() => result.current.trackJoinAttempted());
      expect(mockTrack).toHaveBeenCalledWith("join_room_attempted", {
        route: "/join-room",
        source: "submit_button",
      });
    });

    it("accepts a custom source", () => {
      const { result } = renderHook(() => useJoinRoomTelemetry());
      act(() => result.current.trackJoinAttempted("retry_button"));
      expect(mockTrack).toHaveBeenCalledWith("join_room_attempted", {
        route: "/join-room",
        source: "retry_button",
      });
    });
  });

  describe("trackJoinSucceeded", () => {
    it("emits join_room_succeeded with route only", () => {
      const { result } = renderHook(() => useJoinRoomTelemetry());
      act(() => result.current.trackJoinSucceeded());
      expect(mockTrack).toHaveBeenCalledWith("join_room_succeeded", {
        route: "/join-room",
      });
    });
  });

  describe("trackJoinFailed", () => {
    it.each([
      "validation",
      "not_found",
      "room_full",
      "server_error",
      "unknown",
    ] as const)("emits join_room_failed with error_type=%s", (error_type) => {
      const { result } = renderHook(() => useJoinRoomTelemetry());
      act(() => result.current.trackJoinFailed(error_type));
      expect(mockTrack).toHaveBeenCalledWith("join_room_failed", {
        route: "/join-room",
        error_type,
      });
    });
  });

  describe("PII safety — taxonomy schema", () => {
    it("join_room_form_viewed schema contains no PII fields", async () => {
      const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
      const fields = analyticsEventSchema.join_room_form_viewed as readonly string[];
      ["user_id", "room_code", "wallet_address", "email", "token", "session_id"].forEach((f) =>
        expect(fields).not.toContain(f),
      );
    });

    it("join_room_failed schema contains no PII fields", async () => {
      const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
      const fields = analyticsEventSchema.join_room_failed as readonly string[];
      ["user_id", "room_code", "wallet_address", "email"].forEach((f) =>
        expect(fields).not.toContain(f),
      );
    });

    it("sanitizeAnalyticsPayload strips room_code from join_room_attempted", async () => {
      const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
      const result = sanitizeAnalyticsPayload("join_room_attempted", {
        route: "/join-room",
        source: "submit_button",
        room_code: "TYC001",
      });
      expect(result).not.toHaveProperty("room_code");
      expect(result).toHaveProperty("source", "submit_button");
    });

    it("sanitizeAnalyticsPayload strips user_id from join_room_succeeded", async () => {
      const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
      const result = sanitizeAnalyticsPayload("join_room_succeeded", {
        route: "/join-room",
        user_id: "42",
      });
      expect(result).not.toHaveProperty("user_id");
      expect(result).toHaveProperty("route", "/join-room");
    });
  });
});
