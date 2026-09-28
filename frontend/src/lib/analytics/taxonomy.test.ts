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
});

describe("sanitizeAnalyticsPayload value scrubbing (#1761)", () => {
  it("drops identifier-looking values even under allowed keys", () => {
    expect(
      sanitizeAnalyticsPayload("purchase_click", {
        route: "/shop",
        item_name: "player@example.com",
        item_id: "alice.near",
        item_category: "a".repeat(64),
        currency: "0x1234567890abcdef1234",
        value: 5,
      }),
    ).toEqual({ route: "/shop", value: 5 });
  });

  it("drops JWT-like and oversized strings", () => {
    expect(
      sanitizeAnalyticsPayload("view_shop", {
        route: "/shop",
        source: "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.sig",
        shop_section: "x".repeat(201),
      }),
    ).toEqual({ route: "/shop" });
  });

  it("strips query strings and fragments from routes", () => {
    expect(
      sanitizeAnalyticsPayload("view_home", { route: "/?ref=abc&token=secret#frag" }),
    ).toEqual({ route: "/" });
  });

  it("drops non-finite numbers and non-primitive values", () => {
    expect(
      sanitizeAnalyticsPayload("purchase_click", {
        route: "/shop",
        value: Number.NaN,
        item_id: { nested: true },
      }),
    ).toEqual({ route: "/shop" });
  });

  it("returns an empty payload for an unknown event name", () => {
    expect(sanitizeAnalyticsPayload("not_an_event" as never, { route: "/" })).toEqual({});
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
