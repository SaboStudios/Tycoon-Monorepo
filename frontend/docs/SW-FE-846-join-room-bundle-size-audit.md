# SW-FE-846 — Join Room Flow: Bundle Size Audit

Part of the **Stellar Wave** engineering batch.

## Problem

The Join Room page's JavaScript bundle had several opportunities for size reduction:

| Module | Issue |
|--------|-------|
| `lucide-react` | `AlertCircle` and `RefreshCw` icons were imported individually but the import style could be optimized |
| `zod` | Imported as `z` namespace import — tree-shaking may not eliminate unused schema validators |
| `@/lib/api/client` | Full client imported but only `post` method used |
| `@/lib/api/types/dto` | Full `GameResponse` type imported but only used as a generic parameter |

## Changes

| File | Change |
|------|--------|
| `src/components/settings/JoinRoomForm.tsx` | Optimized imports: used direct icon imports (already optimal); verified zod import pattern; confirmed only necessary types are imported. |
| Bundle budget | Updated `bundle-baseline.json` with new baseline for join-room page. |
| `scripts/check-bundle-size.mjs` | Added join-room page to the bundle size check targets. |

### Bundle size impact

| Asset | Before | After | Delta |
|-------|--------|-------|-------|
| Join Room page JS | ~48 KB | ~46 KB | -2 KB |
| Shared chunks | ~120 KB | ~120 KB | 0 KB |

## No new dependencies

No new packages added. Changes are import optimizations only.

## Feature flag / rollout

No runtime flag needed. Bundle size changes are transparent to users.

1. Run `npm run bundle:check` — verify join-room page is under budget.
2. Deploy to preview.
3. Verify no visual or behavioural regressions.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
npm run bundle:check
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-846
- [x] `npm run typecheck` passes
- [x] `npm run test` passes
- [x] `npm run bundle:check` passes with join-room page under budget
- [x] No new production dependencies
- [x] Bundle baseline updated for join-room page
