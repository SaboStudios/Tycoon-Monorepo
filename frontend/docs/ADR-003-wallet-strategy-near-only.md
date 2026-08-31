# ADR-003 — Wallet Strategy: NEAR-only (Stellar deferred)

**Status:** Accepted  
**Date:** 2026-08-27  
**Issue:** [#1454 — Reconcile Stellar copy vs NEAR-only wallet implementation](https://github.com/SaboStudios/Tycoon-Monorepo/issues/1454)

---

## Context

The frontend contained copy referencing "Stellar Network" in `GameSettingsClient` and
`PlayWithAISettingsClient`, while the actual wallet implementation lives entirely under
`frontend/src/lib/near/` and `frontend/src/components/wallet/NearWalletConnect.tsx`.

The `contract/` directory holds empty Soroban (Stellar) crate scaffolding with no
deployed or functional code. There is no Stellar SDK integrated into the frontend.

Shipping UI that claims two chain integrations when only one exists misleads
contributors and players, and causes incorrect on-call triage.

---

## Decision

1. **NEAR is the sole supported wallet chain until Stellar contracts are production-ready.**
2. All UI copy that previously referenced "Stellar Network" has been updated to reference
   "NEAR wallet" instead.
3. No Stellar client code will be added to the frontend until there is a corresponding
   deployed Soroban contract and a reviewed integration branch.
4. The NEAR testnet checklist at `frontend/docs/NEAR_WALLET_TESTNET_CHECKLIST.md`
   is the canonical manual-QA reference for wallet flows.
5. Network labels in loading states must not hard-code the chain name. Prefer the env
   var `NEXT_PUBLIC_WALLET_NETWORK_LABEL` (default: "NEAR") so this can be changed
   without a code release when Stellar is ready.

---

## Affected files

| File | Change |
|---|---|
| `frontend/src/clients/GameSettingsClient.tsx` | "Stellar Network" → "NEAR wallet" |
| `frontend/src/clients/PlayWithAISettingsClient.tsx` | "Stellar Network" → "NEAR wallet"; "registered" → "NEAR wallet connected" |
| `frontend/src/lib/near/` | No change — canonical wallet library |
| `contract/` | No change — deferred until Soroban integration is scoped |

---

## i18n

The display strings affected are inline JSX, not keyed i18n strings. The copy
changes are safe as-is for the current English-only build. When the i18n system
is extended to cover these components, the keys should be:

- `wallet.checking` — "Checking NEAR wallet…"
- `wallet.connectionFailed` — "Unable to reach the NEAR network. Please try again."
- `wallet.notConnected` — "Please connect your NEAR wallet to host a game."
- `wallet.accessDenied` — "You must connect your NEAR wallet to enter the AI Battle Arena."

---

## Consequences

- Contributors see only one chain referenced in code, reducing "wrong chain" mistakes.
- Adding Stellar later requires: deployed contract → frontend SDK integration →
  update this ADR status to Superseded → new ADR for multi-chain strategy.
- The `contract/` Soroban scaffolding is left intact; it is out of scope for #1454.

---

## Related

- `frontend/docs/NEAR_WALLET_TESTNET_CHECKLIST.md` — manual QA steps for NEAR flows
- `frontend/src/lib/near/README.md` — NEAR error utilities public API
- `backend/docs/ADR-001-shop-purchase-ownership.md` — shop write path
- `backend/docs/ADR-002-games-realtime-transport.md` — transport layer decisions
