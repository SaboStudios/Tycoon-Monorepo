# SW-FE-002 — NEAR Wallet Connect: TypeScript Strictness & Null Guards

Part of the **Stellar Wave** engineering batch.

## What changed

| File | Change |
|------|--------|
| `src/lib/near/execution.ts` | `getTransactionHashFromOutcome` now returns `string \| undefined` instead of `string` (empty string was a silent bad value). `isFinalExecutionSuccess` replaces loose `!status.Failure` boolean coercion with an explicit `=== undefined \|\| === null` check. |
| `src/lib/near/explorer.ts` | `getExplorerTransactionUrl` returns `string \| undefined` and guards against an empty hash, preventing a silently broken explorer URL. |
| `src/components/wallet/NearWalletConnect.tsx` | `onClick` for Disconnect uses a block-body arrow function (`{ void disconnect(); }`) to satisfy `@typescript-eslint/no-misused-promises`. |
| `test/near-execution.test.ts` | New unit tests covering all new `undefined` return paths and the tightened `Failure` check. |

## No breaking changes

- `NearTxRecord.hash` and `NearTxRecord.explorerUrl` were already `string | undefined` — no consumer changes needed.
- The provider's existing `if (hash)` guard is now a proper null-guard rather than a truthiness check on a non-empty string.

## Feature flag / rollout

No runtime flag needed. These are pure type-level and defensive-coding changes with no behaviour difference for the happy path.

1. Deploy to preview; run `npm run typecheck && npm run test`.
2. Promote to production — no staged rollout required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-002
- [x] `npm run typecheck` passes
- [x] `npm run test` covers new null-guard paths
- [x] No new heavy client dependencies added
