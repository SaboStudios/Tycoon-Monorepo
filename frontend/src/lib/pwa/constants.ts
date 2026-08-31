export const PWA_CACHE_PREFIX = "tycoon-shell";
export const PWA_CACHE_VERSION = "v1";
export const PWA_CACHE_NAME = `${PWA_CACHE_PREFIX}-${PWA_CACHE_VERSION}`;
export const PWA_SW_URL = "/sw.js";
export const PWA_SW_SCOPE = "/";
export const PWA_OFFLINE_FALLBACK_URL = "/offline";

export const PWA_SHELL_PATHS = Object.freeze([
  PWA_OFFLINE_FALLBACK_URL,
  "/manifest.json",
  "/favicon.ico",
  "/metadata/apple-touch-icon.png",
  "/metadata/android-chrome-192x192.png",
  "/metadata/android-chrome-512x512.png",
] as const);

/**
 * Paths explicitly excluded from offline caching to prevent stale live game state.
 * These paths are network-only or require real-time synchronization.
 * The service worker checks these patterns in the fetch handler to skip caching.
 *
 * Note: WebSocket upgrades (wss://) are inherently excluded from the fetch handler
 * because the browser does not fire fetch events for WebSocket connections — only
 * for HTTP/HTTPS requests. The `/socket.io/` entry below covers Socket.IO's
 * HTTP long-polling fallback transport, which does go through the fetch handler.
 */
export const PWA_CACHE_EXCLUDED_PATTERNS = Object.freeze([
  "/api/",
  "/game-",
  "/ai-play/",
  "/join-room",
  "/socket.io/",
] as const);

export function isShellAssetPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/metadata/") ||
    PWA_SHELL_PATHS.includes(pathname as (typeof PWA_SHELL_PATHS)[number])
  );
}

/**
 * Check if a path should be excluded from offline caching.
 * Paths matching these patterns stay network-only to prevent stale game state conflicts.
 */
export function isCacheExcludedPath(pathname: string): boolean {
  return PWA_CACHE_EXCLUDED_PATTERNS.some((pattern) => pathname.startsWith(pattern));
}
