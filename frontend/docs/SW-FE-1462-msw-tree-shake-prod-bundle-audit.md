# SW-FE-1462 — MSW tree-shake prod bundle audit

## Why

`msw-provider.tsx` guards the browser service-worker behind `NODE_ENV !== "development"` and `NEXT_PUBLIC_API_MOCKING === "enabled"`.
However a stray static `import` anywhere in the app's module graph could force the bundler to include `msw/browser` — and the service-worker registration code — in production chunks.
If that happened the worker would intercept **real** purchase network traffic, breaking transactions silently.

## What changed

| File | Change |
|---|---|
| `src/mocks/msw-tree-shake.test.ts` | New test suite — 15 source-level assertions |
| `.github/workflows/frontend-ci.yml` | New `MSW tree-shake audit` CI step |

## How the test works

The test mirrors the pattern in `src/lib/analytics/tree-shake.test.ts`.
It reads source files with `node:fs` — no build required — and asserts:

1. **`msw-provider.tsx` has no top-level static import of `@/mocks/browser`** — only a dynamic `import('...')` inside the `useEffect`.
2. **`msw-provider.tsx` guards on both `NODE_ENV` and `NEXT_PUBLIC_API_MOCKING`** so neither a bad env var alone nor a missing env var can activate the worker in production.
3. **`worker.stop()` is called in the cleanup function** so hot-reload stale workers are torn down.
4. **`src/mocks/browser.ts` imports from `msw/browser`** (the browser-only entrypoint, not the Node entrypoint) and has **no top-level `worker.start()` call**.
5. **No app source file outside `src/mocks/`** statically imports `@/mocks/browser`, any MSW handler file, or `msw/browser` directly.
6. **`msw-provider.tsx` has the `"use client"` directive** so it is excluded from SSR entirely.

## CI integration

The `MSW tree-shake audit` step in `frontend-ci.yml` runs immediately after the general test suite and before the production build.
It fails the build if any of the above assertions regress.

## Dev DX preserved

MSW still starts automatically in `development` mode and when `NEXT_PUBLIC_API_MOCKING=enabled` is set (used by Playwright E2E).
The `src/mocks/` directory and its handlers are unchanged.

## Verification

```bash
cd frontend
# Run the audit alone
npm test -- --run src/mocks/msw-tree-shake.test.ts

# Run full suite
npm test -- --run
```
