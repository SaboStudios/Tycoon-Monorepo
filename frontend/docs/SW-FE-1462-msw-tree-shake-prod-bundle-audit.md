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

## Admin surface audit (SW-FE-1462 scope)

This audit also covers the admin mutation surface touched by the same workstream so the MSW tree-shake guarantee is not undermined by admin-only code paths.

### Guards

- Every admin controller must declare `@UseGuards(JwtAuthGuard, AdminGuard)` at the **class level** per `ADMIN_ROUTES_MATRIX.md`.
- `verify-admin-guards.ts` (and related CI scripts) must continue to pass; the script is the source of truth for class-level guard coverage.
- Non-admin tokens must receive `403 Forbidden`; the `admin-role-verification.e2e` spec asserts this for each admin route.

### Auditing

- All admin mutations write an `AuditTrail` entry (actor, action, target, timestamp, outcome).
- Failure paths also write an audit entry — a missing audit on failure is treated as a bug.
- Admin log views redact secrets (tokens, keys, credentials) before rendering; unit tests cover the redaction helper.

### Exports

- Exports use a column allowlist; PII is minimized and never included by default.
- Heavy queries are paginated/limited to prevent export DoS on large ranges.
- The export column allowlist is covered by a dedicated test.

### Matrix

- Any new admin route added under this workstream must be documented in `ADMIN_ROUTES_MATRIX.md` in the same PR.

## Test plan

- `admin-role-verification.e2e` — non-admin 403 + admin happy path
- `verify-admin-guards` — class-level guard coverage
- unit redaction — secrets stripped from admin log views
- export column allowlist test — PII minimization enforced

## Acceptance criteria

- [ ] Guards verified in CI
- [ ] Matrix updated
- [ ] Non-admin 403
- [ ] Auditing complete for mutations
