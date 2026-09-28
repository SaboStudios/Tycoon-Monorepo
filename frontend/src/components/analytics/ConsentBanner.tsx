"use client";

import { useId } from "react";
import Link from "next/link";
import { useAnalyticsConsent } from "@/hooks/useAnalyticsConsent";
import { setConsent } from "@/lib/analytics/consent";
import { isAnalyticsConfigured } from "@/lib/analytics/client";

/**
 * Analytics consent banner (#1761).
 *
 * - Shown only when analytics is configured and no decision is stored; never
 *   rendered on the server, so it cannot cause a hydration mismatch.
 * - Fixed to the viewport bottom so it adds no layout shift (CLS budget).
 * - Non-modal: it does not steal or trap focus. Both choices are native
 *   buttons of equal weight, reachable by Tab in reading order
 *   (policy link -> Decline -> Accept).
 * - Double clicks are harmless: setConsent is idempotent and the banner
 *   unmounts as soon as a decision is stored.
 */
export function ConsentBanner() {
  const consent = useAnalyticsConsent();
  const headingId = useId();
  const descriptionId = useId();

  if (consent !== "unknown" || !isAnalyticsConfigured()) {
    return null;
  }

  return (
    <section
      role="region"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      data-testid="analytics-consent-banner"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--tycoon-border,#0E282A)] bg-[var(--tycoon-bg,#010F10)] px-4 py-4 text-white shadow-lg sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <h2 id={headingId} className="font-semibold">
            Help us improve Tycoon
          </h2>
          <p id={descriptionId} className="text-neutral-300">
            We only collect anonymous usage analytics if you allow it. No wallet
            addresses, emails, or room codes are ever sent.{" "}
            <Link
              href="/privacy-policy"
              className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Privacy policy
            </Link>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setConsent("denied")}
            className="min-h-11 rounded border border-neutral-500 px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => setConsent("granted")}
            className="min-h-11 rounded border border-neutral-500 px-4 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Accept analytics
          </button>
        </div>
      </div>
    </section>
  );
}
