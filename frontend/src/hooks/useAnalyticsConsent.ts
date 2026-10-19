"use client";

import { useSyncExternalStore } from "react";
import { readConsent, subscribeToConsent, type ConsentState } from "@/lib/analytics/consent";

/**
 * Subscribe to the analytics consent decision.
 *
 * Returns `null` during SSR and hydration so consent-dependent UI renders
 * nothing on the server and cannot cause a hydration mismatch; afterwards it
 * returns "granted" | "denied" | "unknown" and stays in sync across tabs.
 */
export function useAnalyticsConsent(): ConsentState | null {
  return useSyncExternalStore<ConsentState | null>(subscribeToConsent, readConsent, () => null);
}
