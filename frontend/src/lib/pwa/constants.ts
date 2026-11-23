export const PWA_CACHE_PREFIX = "tycoon-shell";
export const PWA_CACHE_VERSION = "v1";
export const PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}-${PWA_CACHE_VERSION}`;
export const PWA_SW_URL = "/sw.js";
export const PWA_SW_SCOPE = "/";
export const PWA_OFFLINE_FALLBACK_URL = "/offline";

export const PWA_SHELL_PATHS = [
  PWA_OFFLINE_FALLBACK_URL,
  "/manifest.json",
  "/favicon.ico",
  "/metadata/apple-touch-icon.png",
  "/metadata/android-chrome-192x192.png",
  "/metadata/android-chrome-512x512.png",
] as const;

export function isShellAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/metadata/") ||
    PWA_SHELL_PATHS.includes(pathname as (typeof PWA_SHELL_PATHS)[number])
  );
}

/**
 * Prefixes that must never be served from the offline cache, even if they
 * would otherwise look like a shell asset. Mirrored by hand in `public/sw.js`
 * (a plain JS file that cannot import this module) — see `docs/SW-deny-list.md`.
 *
 * `/shop` and `/api/shop` are explicitly listed (rather than relying only on
 * the general `/api/` prefix) so a cached shop page or purchase response can
 * never resurface a stale price or an active buy button while offline.
 */
export const PWA_CACHE_EXCLUDED_PATTERNS = [
  "/api/",
  "/game-",
  "/ai-play/",
  "/join-room",
  "/socket.io/",
  "/shop",
] as const;

/** True when `pathname` must bypass the service worker cache entirely. */
export function isCacheExcludedPath(pathname: string): boolean {
  return PWA_CACHE_EXCLUDED_PATTERNS.some((pattern) => pathname.startsWith(pattern));
}
