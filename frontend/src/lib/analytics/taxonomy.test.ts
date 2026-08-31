import { describe, expect, it } from "vitest";
import { getViewEventForPath, sanitizeAnalyticsPayload } from "./taxonomy";

describe("sanitizeAnalyticsPayload", () => {
  it("keeps only allowed keys for an event", () => {
    expect(
      sanitizeAnalyticsPayload("purchase_click", {
        route: "/shop",
        item_id: "starter-pack",
        item_name: "Starter Pack",
        value: 20,
        coupon_code: "WELCOME",
      }),
    ).toEqual({
      route: "/shop",
      item_id: "starter-pack",
      item_name: "Starter Pack",
      value: 20,
    });
  });

  it("keeps taxonomy fields that are descriptive but not PII", () => {
    expect(
      sanitizeAnalyticsPayload("purchase_click", {
        route: "/shop",
        item_name: "Starter Pack",
      }),
    ).toEqual({
      route: "/shop",
      item_name: "Starter Pack",
    });
  });

  it("drops pii-like keys even when present", () => {
    expect(
      sanitizeAnalyticsPayload("view_shop", {
        route: "/shop",
        source: "navbar",
        email: "player@example.com",
        wallet_address: "0x123",
      }),
    ).toEqual({
      route: "/shop",
      source: "navbar",
    });
  });

  it("drops explicitly blocked PII fields when a schema accidentally allows them", () => {
    expect(
      sanitizeAnalyticsPayload("purchase_click", {
        route: "/shop",
        name: "Player Name",
        item_name: "Starter Pack",
      }),
    ).toEqual({
      route: "/shop",
      item_name: "Starter Pack",
    });
  });

  it("blocks room codes even when schema allows them", () => {
    expect(
      sanitizeAnalyticsPayload("join_room_attempted", {
        route: "/play",
        source: "link",
        room_code: "ABC123",
        room: "secret-room",
      }),
    ).toEqual({
      route: "/play",
      source: "link",
    });
  });

  it("blocks error types and case-insensitive PII keys", () => {
    expect(
      sanitizeAnalyticsPayload("join_room_failed", {
        route: "/play",
        error_type: "invalid_room",
        USER_ID: "player123",
        EMAIL: "user@example.com",
      }),
    ).toEqual({
      route: "/play",
      error_type: "invalid_room",
    });
  });
});

describe("getViewEventForPath", () => {
  it("maps supported routes to taxonomy view events", () => {
    expect(getViewEventForPath("/")).toBe("view_home");
    expect(getViewEventForPath("/shop")).toBe("view_shop");
    expect(getViewEventForPath("/shop/featured")).toBe("view_shop");
    expect(getViewEventForPath("/play-ai")).toBeNull();
  });
});
