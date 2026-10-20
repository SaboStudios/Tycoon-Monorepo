const CACHE_PREFIX = "tycoon-shell";
const CACHE_VERSION = "v1";
const CACHE_NAME = `${CACHE_PREFIX}-${CACHE_VERSION}`;
const SW_SCOPE = "/";
const OFFLINE_FALLBACK_URL = "/offline";
const SHELL_PATHS = new Set([
  OFFLINE_FALLBACK_URL,
  "/manifest.json",
  "/favicon.ico",
  "/metadata/apple-touch-icon.png",
  "/metadata/android-chrome-192x192.png",
  "/metadata/android-chrome-512x512.png",
]);

function isShellAssetPath(pathname) {
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/metadata/") ||
    SHELL_PATHS.has(pathname)
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(Array.from(SHELL_PATHS)).catch(() => undefined),
    ),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheKeys) =>
        Promise.all(
          cacheKeys.map((cacheKey) => {
            if (cacheKey.startsWith(CACHE_PREFIX) && cacheKey !== CACHE_NAME) {
              return caches.delete(cacheKey);
            }

            return Promise.resolve(false);
          }),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return cache.match(OFFLINE_FALLBACK_URL);
      }),
    );
    return;
  }

  if (
    !isShellAssetPath(url.pathname) ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/game-") ||
    url.pathname.startsWith("/ai-play/") ||
    url.pathname.startsWith("/join-room")
  ) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);

      if (networkResponse.ok) {
        void cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    }),
  );
});
