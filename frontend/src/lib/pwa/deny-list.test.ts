import { describe, expect, it } from "vitest";
import { isCacheExcludedPath, PWA_CACHE_EXCLUDED_PATTERNS } from "./constants";

describe("isCacheExcludedPath (#2159)", () => {
  it("excludes the shop page so a stale price can never be served offline", () => {
    expect(isCacheExcludedPath("/shop")).toBe(true);
    expect(isCacheExcludedPath("/shop/")).toBe(true);
  });

  it("excludes shop-api calls (items, purchase, purchases, inventory, gift)", () => {
    expect(isCacheExcludedPath("/api/shop/items")).toBe(true);
    expect(isCacheExcludedPath("/api/shop/purchase")).toBe(true);
    expect(isCacheExcludedPath("/api/shop/purchases")).toBe(true);
    expect(isCacheExcludedPath("/api/shop/inventory")).toBe(true);
    expect(isCacheExcludedPath("/api/shop/gift")).toBe(true);
  });

  it("still excludes the other documented live/session-specific routes", () => {
    expect(isCacheExcludedPath("/api/games/current")).toBe(true);
    expect(isCacheExcludedPath("/game-play")).toBe(true);
    expect(isCacheExcludedPath("/ai-play/room-1")).toBe(true);
    expect(isCacheExcludedPath("/join-room")).toBe(true);
    expect(isCacheExcludedPath("/socket.io/")).toBe(true);
  });

  it("does not exclude shell assets or already-cacheable game board assets", () => {
    expect(isCacheExcludedPath("/_next/static/chunks/app.js")).toBe(false);
    expect(isCacheExcludedPath("/metadata/android-chrome-192x192.png")).toBe(false);
    expect(isCacheExcludedPath("/offline")).toBe(false);
    // Static game board art lives under /game/... (no trailing dash), distinct
    // from the live /game- route prefix above.
    expect(isCacheExcludedPath("/game/shop/a.jpeg")).toBe(false);
  });

  it("keeps the pattern list and the matcher in sync", () => {
    expect(PWA_CACHE_EXCLUDED_PATTERNS).toContain("/shop");
  });
});
