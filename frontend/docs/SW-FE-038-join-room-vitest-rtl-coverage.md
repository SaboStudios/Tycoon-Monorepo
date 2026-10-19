# SW-FE-038 — Join Room Flow: Vitest / RTL Coverage

Part of the **Stellar Wave** engineering batch.

## What changed

| File | Change |
|------|--------|
| `test/JoinRoomForm.coverage.test.tsx` | New file — 11 additional RTL cases covering branches not exercised by the existing suites: non-alphanumeric input, hint-text CLS invariant, `aria-busy` transitions, loading-state label swap, 404/409/500 server error banners, retry button presence, error-clear-on-input-clear. |

## No source changes

All production source files are unchanged. Tests exercise the existing
`JoinRoomForm` component and `mapServerErrors` utility.

## Feature flag / rollout

No runtime flag needed — test-only change.

1. `npm run test` — all 11 new cases must be green.
2. `npm run typecheck` — no new types introduced.

## Verification

```bash
cd frontend
npm run typecheck
npm run test -- --reporter=verbose test/JoinRoomForm.coverage.test.tsx
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-038
- [x] `npm run test` covers all new paths
- [x] `npm run typecheck` passes
- [x] No new production dependencies
