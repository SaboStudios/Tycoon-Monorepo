# Service Worker Deny-List

The service worker (`public/sw.js`) caches shell assets for offline support but explicitly
**skips caching** for routes that carry live, real-time, or user-session-specific state.

## Why certain routes are excluded

| Pattern | Reason |
|---|---|
| `/api/` | REST API responses are user/session-specific and must never be served stale. |
| `/game-` | Game-play and waiting-room pages require live WebSocket state; a cached page would show a stale or invalid game snapshot. |
| `/ai-play/` | AI game sessions are ephemeral; caching would break reconnection flows. |
| `/join-room` | Room-join handshake must always hit the server to validate the invite. |
| `/socket.io/` | Socket.IO's HTTP long-polling fallback. These XHR/fetch requests must reach the server every time. WebSocket upgrade frames (`wss://`) are already invisible to the fetch handler — the browser never fires a fetch event for them. |

## What is cached

Only **shell assets** are cached:

- `/_next/static/**` — bundled JS/CSS
- `/metadata/**` — app icons
- `/offline` — offline fallback page
- `/manifest.json`, `/favicon.ico`

See `src/lib/pwa/constants.ts` → `PWA_SHELL_PATHS` and `isShellAssetPath`.

## Programmatic access

`isCacheExcludedPath(pathname: string): boolean` in `src/lib/pwa/constants.ts` (also
re-exported from `@/lib/pwa`) mirrors the deny-list for use in app code, tests, and
middleware.

```ts
import { isCacheExcludedPath } from "@/lib/pwa";
isCacheExcludedPath("/socket.io/"); // true
isCacheExcludedPath("/shop");       // false
```

## Adding a new excluded pattern

1. Add the pattern string to `PWA_CACHE_EXCLUDED_PATTERNS` in
   `src/lib/pwa/constants.ts`.
2. Add a matching `url.pathname.startsWith("<pattern>")` condition to the deny-list
   block in `public/sw.js`.
3. Add a test case in `src/lib/pwa/deny-list.test.ts`.

Both files must stay in sync — `sw.js` runs in the browser's service worker scope and
cannot import TypeScript modules.
