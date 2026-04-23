# SW-FE-004 — NEAR Wallet Connect: Performance Budget (CLS / LCP)

Part of the **Stellar Wave** engineering batch.

## Problem

Two performance regressions were identified in the NEAR wallet connect integration:

### 1. LCP — modal CSS on the critical path

`near-wallet-provider.tsx` had a static top-level import:

```ts
import "@near-wallet-selector/modal-ui/styles.css";
```

Because `NearWalletProvider` is mounted in the root layout, this stylesheet was
included in every page's critical CSS bundle — blocking paint even on pages that
never open the wallet modal.

### 2. CLS — unsized wallet UI regions

The button row (`Connect NEAR` / account pill) and the transaction status block
both appeared and disappeared without reserved dimensions. Any content rendered
below the navbar shifted vertically when:

- The wallet finished initialising (`ready` flipped to `true`)
- A transaction record appeared or was cleared

## Changes

| File | Change |
|------|--------|
| `src/components/providers/near-wallet-provider.tsx` | Removed static `import "@near-wallet-selector/modal-ui/styles.css"`. Added the same import **dynamically** inside the existing `Promise.all` that already lazy-loads the selector modules — CSS now loads only when the wallet is bootstrapped, not on first paint. |
| `src/components/wallet/NearWalletConnect.tsx` | Added `min-h-[28px]` to the button row wrapper and wrapped the transaction status block in a permanently-rendered `min-h-[28px]` div. Both regions now hold their space in the layout regardless of wallet state, eliminating the CLS contribution. |
| `test/NearWalletConnect.test.tsx` | Added 3 CLS regression tests: button row has `min-h`, status wrapper is always in the DOM (no transactions), status wrapper present alongside transaction content. |

## No new dependencies

The dynamic CSS import uses the same package already in `dependencies`. No
bundle budget exemption is required.

## Feature flag / rollout

No runtime flag needed. Changes are purely structural (CSS load order, reserved
layout dimensions).

1. Deploy to preview.
2. Run Lighthouse or WebPageTest against the home route — compare LCP and CLS
   scores against the baseline in `bundle-baseline.json`.
3. Confirm wallet modal still opens and styles correctly after the lazy CSS load.
4. Promote to production once no regressions are observed.

**Rollback**: revert this single commit. The static CSS import can be restored
in under a minute with no data migration.

## Verification checklist

```bash
cd frontend
npm run typecheck
npm run test
```

Manual:
- [ ] Open app, click **Connect NEAR** — modal renders with correct styles
- [ ] Submit a contract call — transaction status appears without shifting navbar content
- [ ] Run Lighthouse — CLS score ≤ 0.1, LCP improvement vs baseline
- [ ] Check Network tab — `modal-ui` CSS loads after first paint, not in `<head>`

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-004
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 3 new CLS regression cases
- [x] No new production dependencies
- [x] Modal UI CSS removed from critical path
- [x] Both wallet UI regions have reserved dimensions (no CLS)
