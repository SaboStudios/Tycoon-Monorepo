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

  const trackPurchaseInitiated = useCallback(
    ({ itemId, itemName, itemCategory, itemRarity, currency, value }: ShopItemTelemetryData) => {
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
