/**
 * Privacy-safe telemetry hook for the Purchase modal (SW-FE-030).
 *
 * Privacy guarantees:
 *  - No user IDs, wallet addresses, or session tokens are ever sent.
 *  - Only non-linkable fields: route, item_name, currency, value.
 *  - All payloads pass through sanitizeAnalyticsPayload automatically via track().
 */

"use client";

import { useCallback } from "react";
import { track } from "@/lib/analytics";

export interface PurchaseModalTelemetryData {
  itemName?: string;
  currency?: string;
  value?: string | number;
}

export function usePurchaseModalTelemetry(route = "/shop") {
  const trackModalViewed = useCallback(
    ({ itemName, currency, value }: PurchaseModalTelemetryData) => {
      track("purchase_modal_viewed", { route, item_name: itemName, currency, value });
    },
    [route],
  );

  const trackModalCanceled = useCallback(
    ({ itemName, currency, value }: PurchaseModalTelemetryData) => {
      track("purchase_modal_canceled", { route, item_name: itemName, currency, value });
    },
    [route],
  );

  const trackModalConfirmed = useCallback(
    ({ itemName, currency, value }: PurchaseModalTelemetryData) => {
      track("purchase_modal_confirmed", { route, item_name: itemName, currency, value });
    },
    [route],
  );

  return { trackModalViewed, trackModalCanceled, trackModalConfirmed };
}
