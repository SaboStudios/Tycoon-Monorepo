/**
 * Privacy-safe telemetry hooks for the Join Room flow (SW-FE-039).
 *
 * Privacy guarantees:
 *  - No user IDs, wallet addresses, session tokens, or room codes are sent.
 *  - Only non-linkable fields: route, source, error_type.
 *  - All payloads pass through sanitizeAnalyticsPayload automatically via track().
 *  - Disabled server-side (track() is a no-op in SSR via analytics client guard).
 */

"use client";

import { useCallback } from "react";
import { track } from "@/lib/analytics";

export function useJoinRoomTelemetry(route = "/join-room") {
  const trackFormViewed = useCallback(
    (source = "page_load") => {
      track("join_room_form_viewed", { route, source });
    },
    [route],
  );

  const trackJoinAttempted = useCallback(
    (source = "submit_button") => {
      track("join_room_attempted", { route, source });
    },
    [route],
  );

  const trackJoinSucceeded = useCallback(
    () => {
      track("join_room_succeeded", { route });
    },
    [route],
  );

  const trackJoinFailed = useCallback(
    (error_type: "validation" | "not_found" | "room_full" | "server_error" | "unknown") => {
      track("join_room_failed", { route, error_type });
    },
    [route],
  );

  return { trackFormViewed, trackJoinAttempted, trackJoinSucceeded, trackJoinFailed };
}
