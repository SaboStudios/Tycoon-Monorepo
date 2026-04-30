"use client";

// SW-3: Privacy-safe telemetry hook for the landing hero.
//
// Design principles:
//   - No PII collected (no IP, no user ID, no fingerprinting).
//   - No external analytics SDK — events are dispatched on `window` so any
//     first-party collector (e.g. a future /api/telemetry endpoint) can listen.
//   - Disabled server-side (SSR-safe).
//   - Feature-flagged via NEXT_PUBLIC_TELEMETRY_ENABLED env var.
//   - All event names are string-literal typed to prevent typos.

export type HeroEventName =
  | "hero_view"
  | "hero_cta_click"
  | "hero_join_room_click"
  | "hero_challenge_ai_click"
  | "hero_multiplayer_click";

export interface HeroTelemetryEvent {
  name: HeroEventName;
  /** Milliseconds since page load — no wall-clock timestamp to avoid PII */
  elapsed: number;
}

function isTelemetryEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    process.env.NEXT_PUBLIC_TELEMETRY_ENABLED === "true"
  );
}

let pageLoadTime: number | null = null;

function getElapsed(): number {
  if (typeof window === "undefined") return 0;
  if (pageLoadTime === null) pageLoadTime = performance.now();
  return Math.round(performance.now() - pageLoadTime);
}

export function trackHeroEvent(name: HeroEventName): void {
  if (!isTelemetryEnabled()) return;
  const payload: HeroTelemetryEvent = { name, elapsed: getElapsed() };
  window.dispatchEvent(new CustomEvent("tycoon:telemetry", { detail: payload }));
}

/** React hook — returns a stable fire() callback. */
export function useHeroTelemetry() {
  return { fire: trackHeroEvent };
}
