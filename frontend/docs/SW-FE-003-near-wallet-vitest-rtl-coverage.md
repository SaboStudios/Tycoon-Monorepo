# SW-FE-003 — NEAR Wallet Connect: Vitest / RTL Coverage

Part of the **Stellar Wave** engineering batch.

## What changed

| File | Change |
|------|--------|
| `test/NearWalletConnect.test.tsx` | Expanded from 5 → 13 cases. Added: `ready=false` disables button, `initError` banner, `disconnect` invocation, `failed` phase + `errorMessage`, `confirmed` with no explorer link, `variant="panel"` / `"navbar"` layout classes, short account id no-truncation, `useNearWallet` throws outside provider. |
| `test/near-errors.test.ts` | Expanded from 3 → 9 cases. Added: parameterised rejection phrases via `it.each`, plain-string input, non-Error/non-string values, empty-message fallback, unknown-value fallback. |
| `test/near-config.test.ts` | New file — 8 cases covering `getNearNetworkId` (default, mainnet, case-insensitive, unknown) and `getNearContractId` (default testnet/mainnet, env override, whitespace trim). Previously zero coverage. |
| `test/near-wallet-provider.test.tsx` | New file — covers `callContractMethod` mock resolution, rejection, user-rejection propagation; `clearTransactions` invocation; only-latest-transaction display invariant. |
| `vitest.config.ts` | Added `coverage` block: v8 provider, scoped to `src/lib/near/**`, `src/components/wallet/**`, and `near-wallet-provider.tsx`; thresholds: lines/functions/statements 80%, branches 75%. |

## No breaking source changes

All production source files are unchanged on this branch (source changes live on SW-FE-002).

## Feature flag / rollout

No runtime flag needed — test and config only.

1. `npm run test` — all new cases must be green.
2. `npm run test:coverage` — thresholds must pass for NEAR wallet files.
3. `npm run typecheck` — no new types introduced.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
npm run test:coverage
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-003
- [x] `npm run test` covers all new paths
- [x] `npm run test:coverage` enforces 80% line/function/statement, 75% branch on NEAR wallet files
- [x] `npm run typecheck` passes
- [x] No new production dependencies
