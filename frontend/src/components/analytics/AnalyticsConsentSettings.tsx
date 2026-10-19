"use client";

import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";
import { clearConsent, setConsent } from "@/lib/analytics/consent";

const STATUS_COPY = {
  granted: "Anonymous usage analytics are on.",
  denied: "Analytics are off. Nothing is sent.",
  unknown: "You have not chosen yet. Analytics are off until you do.",
} as const;

/**
 * Lets a player review and withdraw analytics consent at any time (#1761).
 * Withdrawal takes effect immediately: `track()` checks consent per event.
 */
export function AnalyticsConsentSettings() {
  const consent = useAnalyticsConsent();

  if (consent === null) {
    // Pre-hydration placeholder keeps the same height to avoid layout shift.
    return <div className="min-h-[5.5rem]" aria-hidden="true" />;
  }

  return (
    <div className="flex min-h-[5.5rem] flex-col gap-3" data-testid="analytics-consent-settings">
      <p role="status" aria-live="polite">
        {STATUS_COPY[consent]}
      </p>
      <div className="flex flex-wrap gap-2">
        {consent === "granted" ? (
          <button
            type="button"
            onClick={() => setConsent("denied")}
            className="min-h-11 rounded border border-neutral-500 px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Turn off analytics
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setConsent("granted")}
            className="min-h-11 rounded border border-neutral-500 px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Allow analytics
          </button>
        )}
        {consent !== "unknown" && (
          <button
            type="button"
            onClick={clearConsent}
            className="min-h-11 rounded px-4 py-2 text-sm underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Reset my choice
          </button>
        )}
      </div>
    </div>
  );
}
