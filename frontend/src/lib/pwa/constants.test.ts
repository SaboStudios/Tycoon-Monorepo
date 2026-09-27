import { describe, expect, it } from "vitest";
import { isShellAssetPath, PWA_CACHE_NAME, PWA_OFFLINE_FALLBACK_URL } from "./constants";

describe("PWA constants", () => {
  it("uses an explicit versioned cache name", () => {
    expect(PWA_CACHE_NAME).toBe("tycoon-shell-v1");
  });

  it("matches shell-only assets and excludes dynamic state paths", () => {
    expect(isShellAssetPath("/_next/static/chunks/app.js")).toBe(true);
    expect(isShellAssetPath("/metadata/android-chrome-192x192.png")).toBe(true);
    expect(isShellAssetPath(PWA_OFFLINE_FALLBACK_URL)).toBe(true);

    expect(isShellAssetPath("/api/games/current")).toBe(false);
    expect(isShellAssetPath("/game-play")).toBe(false);
    expect(isShellAssetPath("/game-waiting")).toBe(false);
    expect(isShellAssetPath("/_next/image")).toBe(false);
  });
});
