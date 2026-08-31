# SW-FE-039 — NEAR Wallet Connect: Security Hardening Review

Part of the **Stellar Wave** engineering batch.

## What changed

| File | Change |
|------|--------|
| `src/lib/near/security.ts` | **Extended.** Added `isLikelyMainnetId`, `isLikelyTestnetId`, and `assertContractIdForNetwork` for network-aware contract-ID validation. Existing `isDepositSafe`, `sanitizeErrorMessage`, and `MAX_DEPOSIT_YOCTO` unchanged. |
| `src/lib/near/config.ts` | `getNearContractId` now calls `assertContractIdForNetwork(contractId, networkId)` before returning an env-supplied ID. A mainnet-style `.near` account will throw immediately on a testnet-configured build. |
| `src/lib/near/index.ts` | Barrel re-exports `isLikelyMainnetId`, `isLikelyTestnetId`, `assertContractIdForNetwork`. |
| `test/near-security.test.ts` | Extended with `isLikelyMainnetId`, `isLikelyTestnetId`, `assertContractIdForNetwork` suites (11 new tests). |
| `.env.example` | Added `NEXT_PUBLIC_NEAR_NETWORK` and `NEXT_PUBLIC_NEAR_CONTRACT_ID` examples with testnet-only guidance. |

## Security issues addressed (this batch)

| # | Issue | Fix |
|---|-------|-----|
| 1 | `console.error(e)` logged raw wallet errors in production | Guarded with `NODE_ENV !== 'production'` (prior) |
| 2 | `console.warn` echoed raw `NEXT_PUBLIC_NEAR_CONTRACT_ID` value in production | Production log omits the value (prior) |
| 3 | No upper bound on `params.deposit` | `isDepositSafe` rejects above 1 NEAR (prior) |
| 4 | RPC/wallet errors stored verbatim in state | `sanitizeErrorMessage` truncates & redacts (prior) |
| 5 | **New.** A mainnet `.near` contract ID would be silently accepted on a testnet build, risking real-money calls in dev environments | `assertContractIdForNetwork` throws with a clear error message before any wallet interaction |

## How the allowlist works

`.near` top-level accounts are mainnet-only in the NEAR protocol. Any contract
ID ending in `.near` (but not `.testnet`) is treated as a mainnet identifier.

When `NEXT_PUBLIC_NEAR_NETWORK=testnet` (the default), passing such an ID to
`getNearContractId` throws:

```
Error: Contract ID "social.near" looks like a mainnet account but
NEXT_PUBLIC_NEAR_NETWORK is set to "testnet". Use a testnet contract ID
(e.g. "mycontract.testnet") or set NEXT_PUBLIC_NEAR_NETWORK=mainnet
to target the mainnet.
```

Implicit 64-hex accounts (valid on both networks) are not flagged.

## Config example

```bash
# .env.local — testnet-only configuration (safe for development)
NEXT_PUBLIC_NEAR_NETWORK=testnet
NEXT_PUBLIC_NEAR_CONTRACT_ID=myapp.testnet   # Must end with .testnet when network=testnet
```

Setting `NEXT_PUBLIC_NEAR_CONTRACT_ID=myapp.near` while
`NEXT_PUBLIC_NEAR_NETWORK=testnet` will **throw at startup** — intentional.

## No breaking changes

- `callContractMethod` callers using a testnet ID on testnet are unaffected.
- Callers using a mainnet ID on mainnet are unaffected.
- Callers not setting `NEXT_PUBLIC_NEAR_CONTRACT_ID` fall through to the
  built-in default (which is always network-appropriate).

## Verification

```bash
cd frontend
npm run typecheck
npm run test -- --run test/near-security.test.ts
```

## Acceptance criteria

- [x] Mismatch throws with a descriptive error message
- [x] Tests cover mainnet-on-testnet throw, testnet-on-testnet pass, mainnet-on-mainnet pass, implicit IDs pass
- [x] Docs updated (this file)
- [x] `.env.example` shows testnet-only `NEXT_PUBLIC_NEAR_CONTRACT_ID`
- [x] No new production dependencies
