/**
 * Public surface tests for @/lib/pwa
 *
 * Verifies that every symbol declared in index.ts is importable from the
 * barrel and has the expected shape, so a breaking internal rename is caught
 * before it reaches consumers.
 */

import { describe, expect, it } from "vitest";
import {
  isShellAssetPath,
  PWA_CACHE_NAME,
  PWA_CACHE_PREFIX,
  PWA_CACHE_VERSION,
  PWA_OFFLINE_FALLBACK_URL,
  PWA_SHELL_PATHS,
  PWA_SW_SCOPE,
  PWA_SW_URL,
} from ".";

// ---------------------------------------------------------------------------
// Public surface — all named exports must be present and typed correctly
// ---------------------------------------------------------------------------

describe("@/lib/pwa public surface", () => {
  it("exports PWA_CACHE_PREFIX as a non-empty string", () => {
    expect(typeof PWA_CACHE_PREFIX).toBe("string");
    expect(PWA_CACHE_PREFIX.length).toBeGreaterThan(0);
  });

  it("exports PWA_CACHE_VERSION as a non-empty string", () => {
    expect(typeof PWA_CACHE_VERSION).toBe("string");
    expect(PWA_CACHE_VERSION.length).toBeGreaterThan(0);
  });

  it("exports PWA_CACHE_NAME composed from prefix and version", () => {
    expect(PWA_CACHE_NAME).toBe(`${PWA_CACHE_PREFIX}-${PWA_CACHE_VERSION}`);
  });

  it("exports PWA_SW_URL as a non-empty string", () => {
    expect(typeof PWA_SW_URL).toBe("string");
    expect(PWA_SW_URL.length).toBeGreaterThan(0);
  });

  it("exports PWA_SW_SCOPE as a non-empty string", () => {
    expect(typeof PWA_SW_SCOPE).toBe("string");
    expect(PWA_SW_SCOPE.length).toBeGreaterThan(0);
  });

  it("exports PWA_OFFLINE_FALLBACK_URL as a non-empty string", () => {
    expect(typeof PWA_OFFLINE_FALLBACK_URL).toBe("string");
    expect(PWA_OFFLINE_FALLBACK_URL.length).toBeGreaterThan(0);
  });

  it("exports PWA_SHELL_PATHS as a readonly array of strings", () => {
    expect(Array.isArray(PWA_SHELL_PATHS)).toBe(true);
    expect(PWA_SHELL_PATHS.length).toBeGreaterThan(0);
    for (const p of PWA_SHELL_PATHS) {
      expect(typeof p).toBe("string");
    }
  });

  it("exports isShellAssetPath as a function", () => {
    expect(typeof isShellAssetPath).toBe("function");
  });
});

// ---------------------------------------------------------------------------
// isShellAssetPath — stale, disconnected, and invalid input handling
// ---------------------------------------------------------------------------

describe("isShellAssetPath — edge and invalid inputs", () => {
  it("returns false for an empty string", () => {
    expect(isShellAssetPath("")).toBe(false);
  });

  it("returns false for a bare slash (root navigation path)", () => {
    // The root path is a navigation request, not a shell asset
    expect(isShellAssetPath("/")).toBe(false);
  });

  it("returns false for a path that only partially matches a prefix", () => {
    // '/_next/' alone is not a static asset path
    expect(isShellAssetPath("/_next/")).toBe(false);
    expect(isShellAssetPath("/_next/image")).toBe(false);
  });

  it("returns false for API routes that should never be cached", () => {
    expect(isShellAssetPath("/api/games/current")).toBe(false);
    expect(isShellAssetPath("/api/users/me")).toBe(false);
  });

  it("returns false for dynamic game paths", () => {
    expect(isShellAssetPath("/game-play")).toBe(false);
    expect(isShellAssetPath("/game-waiting")).toBe(false);
    expect(isShellAssetPath("/game-lobby/abc123")).toBe(false);
  });

  it("returns true for all entries in PWA_SHELL_PATHS", () => {
    for (const p of PWA_SHELL_PATHS) {
      expect(isShellAssetPath(p)).toBe(true);
    }
  });

  it("returns true for any /_next/static/ sub-path", () => {
    expect(isShellAssetPath("/_next/static/chunks/main.js")).toBe(true);
    expect(isShellAssetPath("/_next/static/css/app.css")).toBe(true);
    expect(isShellAssetPath("/_next/static/media/font.woff2")).toBe(true);
  });

  it("returns true for any /metadata/ sub-path", () => {
    expect(isShellAssetPath("/metadata/android-chrome-192x192.png")).toBe(true);
    expect(isShellAssetPath("/metadata/apple-touch-icon.png")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PWA_SHELL_PATHS — integrity checks
// ---------------------------------------------------------------------------

describe("PWA_SHELL_PATHS integrity", () => {
  it("includes the offline fallback URL", () => {
    expect(PWA_SHELL_PATHS).toContain(PWA_OFFLINE_FALLBACK_URL);
  });

  it("includes the web app manifest", () => {
    expect(PWA_SHELL_PATHS).toContain("/manifest.json");
  });

  it("includes the favicon", () => {
    expect(PWA_SHELL_PATHS).toContain("/favicon.ico");
  });

  it("has no duplicate entries", () => {
    const unique = new Set(PWA_SHELL_PATHS);
    expect(unique.size).toBe(PWA_SHELL_PATHS.length);
  });

  it("has no entries with trailing slashes", () => {
    for (const p of PWA_SHELL_PATHS) {
      expect(p.endsWith("/")).toBe(false);
    }
  });
});
