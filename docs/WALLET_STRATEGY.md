# Wallet Strategy — NEAR vs Stellar

> **Status:** NEAR is the sole supported wallet chain. Stellar (Soroban) is deferred.  
> See [ADR-003](../frontend/docs/ADR-003-wallet-strategy-near-only.md) for the full decision record.

---

## Decision Table

| Dimension | NEAR | Stellar / Soroban |
|---|---|---|
| **Status** | ✅ Live in production | 🔲 Deferred — scaffolding only |
| **Frontend integration** | `frontend/src/lib/near/` + `NearWalletConnect.tsx` | None — no SDK in the frontend |
| **Smart contracts** | External NEAR contract (`NEXT_PUBLIC_NEAR_CONTRACT_ID`) | `contract/` — crate scaffolding exists; no deployed contract |
| **Testnet ready** | ✅ Yes — see checklist below | ❌ No — contracts not deployed |
| **What the UI may claim** | "Connect your NEAR wallet" | Nothing — no Stellar UI copy permitted until contracts are production-ready |
| **Wallet SDK** | `@near-wallet-selector/*` (see `frontend/package.json`) | Not installed |
| **Network label env var** | `NEXT_PUBLIC_NEAR_NETWORK` (default: `testnet`) | N/A |
| **Contract ID env var** | `NEXT_PUBLIC_NEAR_CONTRACT_ID` (default: `guest-book.testnet`) | N/A |
| **Chain for in-game currency** | NEAR (future scope) | `tycoon-token` crate (not deployed) |
| **NFT collectibles** | Not yet scoped | `tycoon-collectibles` crate (not deployed) |

---

## What UI May and May Not Claim

These rules flow directly from [ADR-003](../frontend/docs/ADR-003-wallet-strategy-near-only.md):

| Context | ✅ Allowed | ❌ Not allowed |
|---|---|---|
| Wallet connect buttons | "Connect NEAR wallet" | "Connect Stellar wallet" / "Connect wallet" with Stellar branding |
| Loading / checking states | "Checking NEAR wallet…" | Any Stellar or multi-chain copy |
| Error messages | "Unable to reach the NEAR network. Please try again." | References to Stellar, XLM, or Soroban |
| Game settings | "NEAR wallet connected" | "Stellar Network", "Registered on Stellar" |
| Network indicator | Value of `NEXT_PUBLIC_WALLET_NETWORK_LABEL` (default: `"NEAR"`) | Hard-coded chain names in JSX |

UI copy must use the env var `NEXT_PUBLIC_WALLET_NETWORK_LABEL` for any displayed chain name so it can be updated without a code release when Stellar integration is ready.

---

## NEAR Testnet Checklist

Full manual QA steps: [`frontend/docs/NEAR_WALLET_TESTNET_CHECKLIST.md`](../frontend/docs/NEAR_WALLET_TESTNET_CHECKLIST.md)

Quick reference:

1. Set `NEXT_PUBLIC_NEAR_NETWORK=testnet` (this is the default).
2. Optionally set `NEXT_PUBLIC_NEAR_CONTRACT_ID` if testing a non-default contract.
3. Connect → confirm account pill appears in header.
4. Disconnect → confirm pill disappears.
5. Reject a signature prompt → confirm friendly error toast.
6. Submit a contract call → confirm pending → confirmed transition and explorer link.
7. Test on mobile → confirm bottom-sheet NEAR block.

---

## Stellar / Soroban Roadmap Crates

The `contract/` workspace contains the following Soroban crate scaffolding. None are deployed. They exist to define the intended contract surface for when Stellar integration is scoped.

| Crate | Path | Purpose |
|---|---|---|
| `tycoon-main-game` | `contract/contracts/tycoon-main-game/` | Players, games, lobbies |
| `tycoon-game` | `contract/contracts/tycoon-game/` | Core game mechanics and state |
| `tycoon-token` | `contract/contracts/tycoon-token/` | ERC-20 style in-game currency |
| `tycoon-reward-system` | `contract/contracts/tycoon-reward-system/` | Reward distribution and achievements |
| `tycoon-collectibles` | `contract/contracts/tycoon-collectibles/` | NFT collectibles and items |
| `tycoon-boost-system` | `contract/contracts/tycoon-boost-system/` | Power-ups and boost mechanics |
| `tycoon-lib` | `contract/contracts/tycoon-lib/` | Shared utilities |

All crates use **Soroban SDK v23** (see `contract/Cargo.toml`).

Build the WASM artifacts locally:

```bash
cd contract
make dev     # format + clippy + test + build-wasm
make ci      # exact CI parity
```

See [`contract/README.md`](../contract/README.md) for full build and deployment instructions.

---

## Adding Stellar Later

Before any Stellar copy can appear in the UI, all three gates must be cleared:

1. **Deployed contract** — at least one Soroban contract deployed to testnet with a verified contract ID.
2. **Frontend SDK integration** — Stellar SDK installed and a reviewed integration branch merged.
3. **ADR updated** — ADR-003 status changed to `Superseded` and a new multi-chain ADR accepted.

---

## Related

- [ADR-003 — Wallet Strategy: NEAR-only](../frontend/docs/ADR-003-wallet-strategy-near-only.md)
- [NEAR Wallet Testnet Checklist](../frontend/docs/NEAR_WALLET_TESTNET_CHECKLIST.md)
- [NEAR lib public API](../frontend/src/lib/near/README.md)
- [contract/README.md](../contract/README.md)
- [ADR-001 — Shop Purchase Ownership](../backend/docs/ADR-001-shop-purchase-ownership.md)
