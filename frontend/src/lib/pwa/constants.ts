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
