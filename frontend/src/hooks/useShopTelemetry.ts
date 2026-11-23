/**
 * Privacy-safe telemetry hooks for the Shop grid (SW-FE-006).
 *
 * Privacy guarantees:
 *  - No user IDs, wallet addresses, or session tokens are ever sent.
 *  - Only non-linkable fields: route, item_id, item_name, item_category,
 *    item_rarity, currency, value, item_count, source.
 *  - All payloads pass through sanitizeAnalyticsPayload automatically via track().
 */

"use client";

import { useCallback } from "react";
import { track } from "@/lib/analytics";
import { hasAnalyticsConsent } from "@/lib/analytics/consent";

export interface ShopItemTelemetryData {
  itemId: string;
  itemName: string;
  itemCategory?: string;
  itemRarity?: string;
  currency?: string;
  value?: number | string;
}

export function useShopTelemetry(route = "/shop") {
  const trackGridViewed = useCallback(
    (itemCount: number, source = "page_load") => {
      track("shop_grid_viewed", { route, item_count: itemCount, source });
    },
    [route],
  );

  const trackItemImpression = useCallback(
    ({ itemId, itemName, itemCategory, itemRarity }: ShopItemTelemetryData) => {
      track("shop_item_impression", {
        route,
        item_id: itemId,
        item_name: itemName,
        item_category: itemCategory,
        item_rarity: itemRarity,
      });
    },
    [route],
  );

  /**
   * Emits the purchase event — but only for a confirmed purchase.
   *
   * `status` is required (not defaulted) so a caller must say what actually
   * happened. A failed or conflicted purchase is not a sale: only `"success"`
   * emits, and only when the user has granted analytics consent. This must
   * be called from the success branch of the purchase flow (e.g.
   * `PurchaseButton`'s `onPurchased`), never from the click handler that
   * merely starts the purchase — firing on click double-counts failed and
   * conflicted attempts as revenue (#2151).
   */
  const trackPurchaseInitiated = useCallback(
    (
      { itemId, itemName, itemCategory, itemRarity, currency, value }: ShopItemTelemetryData,
      status: "success" | "error" | "conflict",
    ) => {
      if (status !== "success") return;
      if (!hasAnalyticsConsent()) return;

      track("shop_purchase_initiated", {
        route,
        item_id: itemId,
        item_name: itemName,
        item_category: itemCategory,
        item_rarity: itemRarity,
        currency,
        value,
      });
    },
    [route],
  );

  return { trackGridViewed, trackItemImpression, trackPurchaseInitiated };
}
