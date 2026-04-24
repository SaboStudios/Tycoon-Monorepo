/**
 * SW-FE-006 — useShopTelemetry unit tests
 * Verifies privacy-safe telemetry hooks for the Shop grid.
 */

import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/analytics", () => ({ track: vi.fn() }));

import { track } from "@/lib/analytics";
import { useShopTelemetry } from "@/hooks/useShopTelemetry";

const mockTrack = vi.mocked(track);

beforeEach(() => mockTrack.mockClear());

describe("useShopTelemetry", () => {
  describe("trackGridViewed", () => {
    it("emits shop_grid_viewed with item_count and default source", () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => result.current.trackGridViewed(5));
      expect(mockTrack).toHaveBeenCalledWith("shop_grid_viewed", {
        route: "/shop",
        item_count: 5,
        source: "page_load",
      });
    });

    it("accepts a custom source", () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => result.current.trackGridViewed(3, "game_overlay"));
      expect(mockTrack).toHaveBeenCalledWith("shop_grid_viewed", {
        route: "/shop",
        item_count: 3,
        source: "game_overlay",
      });
    });

    it("uses the route passed to the hook", () => {
      const { result } = renderHook(() => useShopTelemetry("/game/shop"));
      act(() => result.current.trackGridViewed(2));
      expect(mockTrack).toHaveBeenCalledWith("shop_grid_viewed", expect.objectContaining({ route: "/game/shop" }));
    });
  });

  describe("trackItemImpression", () => {
    it("emits shop_item_impression with non-PII fields", () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() =>
        result.current.trackItemImpression({
          itemId: "42",
          itemName: "Golden House",
          itemCategory: "skin",
          itemRarity: "rare",
        }),
      );
      expect(mockTrack).toHaveBeenCalledWith("shop_item_impression", {
        route: "/shop",
        item_id: "42",
        item_name: "Golden House",
        item_category: "skin",
        item_rarity: "rare",
      });
    });

    it("works without optional fields", () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() => result.current.trackItemImpression({ itemId: "1", itemName: "Dice" }));
      expect(mockTrack).toHaveBeenCalledWith("shop_item_impression", {
        route: "/shop",
        item_id: "1",
        item_name: "Dice",
        item_category: undefined,
        item_rarity: undefined,
      });
    });
  });

  describe("trackPurchaseInitiated", () => {
    it("emits shop_purchase_initiated with price and currency", () => {
      const { result } = renderHook(() => useShopTelemetry());
      act(() =>
        result.current.trackPurchaseInitiated({
          itemId: "7",
          itemName: "Lucky Dice",
          itemCategory: "dice",
          itemRarity: "common",
          currency: "USD",
          value: 50,
        }),
      );
      expect(mockTrack).toHaveBeenCalledWith("shop_purchase_initiated", {
        route: "/shop",
        item_id: "7",
        item_name: "Lucky Dice",
        item_category: "dice",
        item_rarity: "common",
        currency: "USD",
        value: 50,
      });
    });
  });

  describe("PII safety — taxonomy schema", () => {
    it("shop_grid_viewed schema contains no PII fields", async () => {
      const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
      const fields = analyticsEventSchema.shop_grid_viewed as readonly string[];
      ["user_id", "wallet_address", "email", "token", "session_id"].forEach((f) =>
        expect(fields).not.toContain(f),
      );
    });

    it("shop_purchase_initiated schema contains no PII fields", async () => {
      const { analyticsEventSchema } = await import("@/lib/analytics/taxonomy");
      const fields = analyticsEventSchema.shop_purchase_initiated as readonly string[];
      ["user_id", "wallet_address", "email", "token"].forEach((f) =>
        expect(fields).not.toContain(f),
      );
    });

    it("sanitizeAnalyticsPayload strips user_id from shop_grid_viewed", async () => {
      const { sanitizeAnalyticsPayload } = await import("@/lib/analytics/taxonomy");
      const result = sanitizeAnalyticsPayload("shop_grid_viewed", {
        route: "/shop",
        item_count: 3,
        source: "page_load",
        user_id: "12345",
      });
      expect(result).not.toHaveProperty("user_id");
      expect(result).toHaveProperty("item_count", 3);
    });
  });
});
