/**
 * Privacy-safe telemetry hook for the landing hero (#828).
 *
 * Privacy guarantees:
 *  - No user IDs, wallet addresses, or session tokens are ever sent.
 *  - Only non-linkable fields: route, source, cta, destination.
 *  - All payloads pass through sanitizeAnalyticsPayload automatically via track().
 *  - Disabled server-side (track() is a no-op in SSR via analytics client guard).
 */

"use client";

import { useCallback } from "react";
import { track } from "@/lib/analytics";

export type HeroCta =
  | "continue_game"
  | "multiplayer"
  | "join_room"
  | "challenge_ai";

export function useHeroTelemetry(route = "/") {
  const trackHeroViewed = useCallback(
    (source = "page_load") => {
      track("hero_viewed", { route, source });
    },
    [route],
  );

  const trackCtaClicked = useCallback(
    (cta: HeroCta, destination: string) => {
      track("hero_cta_clicked", { route, cta, destination });
    },
    [route],
  );

  return { trackHeroViewed, trackCtaClicked };
}
