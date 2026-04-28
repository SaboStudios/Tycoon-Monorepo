# SW-FE-039 — NEAR Wallet Connect: Security Hardening Review

Part of the **Stellar Wave** engineering batch.

## What changed

| File | Change |
|------|--------|
| `src/lib/near/security.ts` | **New.** `isDepositSafe` — rejects deposits above 1 NEAR (10²⁴ yoctoNEAR). `sanitizeErrorMessage` — truncates at 200 chars and redacts seed-phrase / private-key patterns before messages reach state or the UI. |
| `src/components/providers/near-wallet-provider.tsx` | Import `isDepositSafe`, `sanitizeErrorMessage`, `MAX_DEPOSIT_YOCTO`. Guard `console.error` to dev-only. Validate `params.deposit` before signing. Apply `sanitizeErrorMessage` to RPC/wallet error messages before storing in transaction state. Remove duplicate `deposit` declaration. |
| `src/lib/near/config.ts` | `console.warn` no longer echoes the raw env value in production — only logs a generic message. Dev builds still show the full value for debuggability. |
| `test/near-security.test.ts` | **New.** 9 unit tests covering `isDepositSafe` (zero, max, over-limit, negative) and `sanitizeErrorMessage` (truncation, custom maxLen, seed phrase redaction, private key redaction, safe short string). |
| `test/near-wallet-provider.test.tsx` | 2 new cases: deposit guard rejects oversized value; accepts exactly `MAX_DEPOSIT_YOCTO`. |

## Security issues addressed

| # | Issue | Fix |
|---|-------|-----|
| 1 | `console.error(e)` logged raw wallet errors (stack traces, RPC URLs) in production | Guarded with `NODE_ENV !== 'production'` |
| 2 | `console.warn` echoed raw `NEXT_PUBLIC_NEAR_CONTRACT_ID` value in production | Production log omits the value; dev log retains it |
| 3 | No upper bound on `params.deposit` — typo could send 10¹⁸ NEAR | `isDepositSafe` rejects anything above 1 NEAR before signing |
| 4 | RPC/wallet error messages stored verbatim in React state and rendered in UI | `sanitizeErrorMessage` truncates and redacts seed-phrase / private-key patterns |

## No breaking changes

- `callContractMethod` callers passing `deposit` ≤ 1 NEAR are unaffected.
- Error message display is unchanged for normal errors (< 200 chars, no key material).
- `MAX_DEPOSIT_YOCTO` is exported — callers that need a higher limit can override by not using `callContractMethod` directly.

## Feature flag / rollout

No runtime flag needed. All changes are defensive guards with no behaviour difference on the happy path.

1. Deploy to preview; run `npm run typecheck && npm run test`.
2. Smoke-test wallet connect + a contract call on testnet.
3. Promote to production — no staged rollout required.

**Rollback**: revert this single commit. No data migration required.

## Verification

```bash
cd frontend
npm run typecheck
npm run test
```

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-039
- [x] `npm run typecheck` passes
- [x] `npm run test` covers all new security paths
- [x] No new production dependencies
- [x] Raw error objects not logged in production
- [x] Deposit upper bound enforced before signing
- [x] Error messages sanitized before entering React state
