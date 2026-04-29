/**
 * Privacy-safe telemetry hook for the Purchase modal (SW-FE-030).
 *
 * Privacy guarantees:
 *  - No user IDs, wallet addresses, or session tokens are ever sent.
 *  - Only non-linkable fields: route, item_name, currency, value.
 *  - All payloads pass through sanitizeAnalyticsPayload automatically via track().
 */

'use client';

import { useCallback } from 'react';
import { track } from '@/lib/analytics';

export interface PurchaseModalTelemetryData {
  readonly itemName?: string;
  readonly currency?: string;
  readonly value?: string | number;
}

export type TrackPurchaseModalFn = (data: PurchaseModalTelemetryData) => void;

export interface PurchaseModalTelemetry {
  readonly trackModalViewed: TrackPurchaseModalFn;
  readonly trackModalCanceled: TrackPurchaseModalFn;
  readonly trackModalConfirmed: TrackPurchaseModalFn;
}

export function usePurchaseModalTelemetry(route = '/shop'): PurchaseModalTelemetry {
  const trackModalViewed = useCallback<TrackPurchaseModalFn>(
    ({ itemName, currency, value }) => {
      track('purchase_modal_viewed', { route, item_name: itemName, currency, value });
    },
    [route],
  );

  const trackModalCanceled = useCallback<TrackPurchaseModalFn>(
    ({ itemName, currency, value }) => {
      track('purchase_modal_canceled', { route, item_name: itemName, currency, value });
    },
    [route],
  );

  const trackModalConfirmed = useCallback<TrackPurchaseModalFn>(
    ({ itemName, currency, value }) => {
      track('purchase_modal_confirmed', { route, item_name: itemName, currency, value });
    },
    [route],
  );

  return { trackModalViewed, trackModalCanceled, trackModalConfirmed };
}
