/**
 * Thin analytics client used by near/telemetry.ts.
 * Delegates to the shared analytics layer via a loose cast so NEAR-specific
 * event names don't need to be added to the shared taxonomy union.
 */
import { track as analyticsTrack } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/taxonomy";

export function track(
  event: string,
  properties?: Record<string, unknown>,
): void {
  analyticsTrack(event as AnalyticsEventName, properties ?? {});
}
