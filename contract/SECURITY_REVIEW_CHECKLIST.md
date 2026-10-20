# Workspace Security Review Checklist — Soroban Contracts (SW-CONTRACT-HYGIENE-001)

**Stellar Wave batch** | **Issue:** SW-CONTRACT-HYGIENE-001 | **PR:** references SW-CONTRACT-HYGIENE-001

This document is the single authoritative workspace-level security checklist for all
contracts under `contract/contracts/`. Per-contract checklists live alongside each
crate and are linked below.

---

## 1. Per-Contract Checklist Status

| Contract | Checklist | Status |
|---|---|---|
| tycoon-token | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-token/SECURITY_REVIEW_CHECKLIST.md) | ✅ Complete |
| tycoon-collectibles | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-collectibles/SECURITY_REVIEW_CHECKLIST.md) | ⚠️ Items unchecked — pre-mainnet |
| tycoon-boost-system | [SECURITY_REVIEW_CHECKLIST.md](contracts/tycoon-boost-system/SECURITY_REVIEW_CHECKLIST.md) | ✅ Complete (1 open medium) |
| tycoon-reward-system | No dedicated checklist | 🔲 Needed before mainnet |
| tycoon-game | No dedicated checklist | 🔲 Needed before mainnet |
| tycoon-lib | No public entrypoints | ✅ Library only — no auth surface |

---

## 2. Workspace-Wide Security Properties

### 2.1 No Unaudited Oracle or Privileged Pattern in Production

- [x] No contract reads an external price feed or oracle
- [x] All privileged roles (admin, backend minter, game controller) are set at `initialize` time and require `require_auth()` on every mutation
- [x] No contract grants itself elevated privileges via `env.current_contract_address()` as an auth principal
- [ ] **OPEN:** `tycoon-game::admin_mint_registration_voucher` has no idempotency guard — tracked as BLK-002 in `CEI_SECURITY_AUDIT.md`
- [ ] **OPEN:** `tycoon-collectibles::buy_collectible` allows free unlimited minting — tracked as BLK-001 in `CEI_SECURITY_AUDIT.md`

### 2.2 CEI (Checks-Effects-Interactions) Compliance

All cross-contract calls audited in `CEI_SECURITY_AUDIT.md`. Summary:

| Contract | Function | CEI Status |
|---|---|---|
| tycoon-reward-system | `redeem_voucher_from` | ✅ Fixed |
| tycoon-collectibles | `buy_collectible_from_shop` | ✅ Fixed |
| tycoon-main-game | `leave_pending_game` | ✅ Fixed |
| tycoon-game | `withdraw_funds` | ✅ Safe (no post-call mutation) |
| tycoon-collectibles | `buy_collectible` | 🔴 Blocker — free mint, no payment |

### 2.3 Integer Arithmetic

- [x] All token balance mutations use `checked_add` / `checked_sub` with explicit panic messages
- [x] `tycoon-token`: `mint` uses `checked_add` on balance and total supply
- [x] `tycoon-token`: `burn` / `burn_from` use `checked_sub` on total supply
- [x] `tycoon-reward-system`: `_mint` uses `checked_add`; `_burn` uses explicit `>=` guard before subtraction
- [x] `tycoon-boost-system`: stacking arithmetic uses `u64` intermediates to avoid `u32` overflow
- [x] Cargo workspace profile sets `overflow-checks = true` for release builds

### 2.4 Access Control Patterns

- [x] Every admin-only entrypoint calls `require_auth()` on the stored admin address before any state mutation
- [x] `initialize` functions are one-time guarded (panic on re-call)
- [x] No function grants a caller elevated privileges based on caller-supplied input alone
- [x] Backend minter / game controller roles are scoped — they cannot pause, withdraw, or set admin

### 2.5 Event Auditability

- [x] All state-changing operations emit at least one event
- [x] Admin role changes emit events with old + new addresses (tycoon-token `SetAdminEvent`)
- [x] Pause / unpause emit events
- [x] Deprecated function calls emit `DeprecatedFunctionCalledEvent` (tycoon-boost-system)
- [x] No sensitive data (private keys, off-chain secrets) appears in event topics or data

### 2.6 Storage Economics

- [x] Persistent storage entries are removed (not zero-written) when they reach a terminal state
- [x] No unbounded loops over storage — pagination used where enumeration is needed
- [x] Expired boosts are pruned on write paths to prevent unbounded growth
- [x] WASM size budget enforced via `contract/ci/wasm-size-budget.json` and `scripts/check-wasm-sizes.sh`

---

## 3. Soroban Best Practices Compliance

| Practice | Status | Notes |
|---|---|---|
| `resolver = "2"` in workspace Cargo.toml | ✅ | |
| `overflow-checks = true` in release profile | ✅ | |
| `panic = "abort"` in release profile | ✅ | Reduces WASM size; no unwinding |
| `lto = true`, `codegen-units = 1` | ✅ | Optimal WASM size |
| `opt-level = "z"` | ✅ | Size-optimised |
| No `std` in contract crates (`#![no_std]`) | ✅ | All contract crates |
| `soroban-sdk` version pinned at workspace level | ✅ | `soroban-sdk = "23"` |
| Auth checked before state mutation | ✅ | Verified per-contract |
| CEI pattern followed for cross-contract calls | ✅ (with noted blockers) | See §2.2 |
| No raw `unwrap()` on storage reads in production paths | ✅ | `expect("message")` used throughout |

---

## 4. Blockers (Must Fix Before Mainnet)

| ID | Contract | Issue | Severity | Reference |
|---|---|---|---|---|
| BLK-001 | tycoon-collectibles | `buy_collectible` allows free unlimited minting | Critical | CEI_SECURITY_AUDIT.md §2.7 |
| BLK-002 | tycoon-game | `admin_mint_registration_voucher` has no idempotency guard | Medium | CEI_SECURITY_AUDIT.md §2.5 |

---

## 5. Open Medium Issues

| ID | Contract | Issue | Severity |
|---|---|---|---|
| SW-CONTRACT-HYGIENE-001-M1 | tycoon-boost-system | No `set_admin` / admin key rotation | Medium |
| SW-CONTRACT-HYGIENE-001-M2 | tycoon-reward-system | No dedicated security checklist | Medium |
| SW-CONTRACT-HYGIENE-001-M3 | tycoon-game | No dedicated security checklist | Medium |

---

## 6. CI Requirements

Before merging any PR that touches `contract/`:

- [ ] `cargo check --workspace` passes (excludes `archive/` and `tycoon-main-game` per workspace exclusions)
- [ ] `cargo test --workspace` passes
- [ ] `contract/scripts/check-wasm-sizes.sh` passes (WASM within budget)
- [ ] This checklist reviewed and updated if new entrypoints or roles are added

---

## 7. External Audit

An external audit is recommended before mainnet deployment. See `CEI_SECURITY_AUDIT.md §6` for scope and estimated cost.

**Sign-off required from:** Tech Lead, Smart Contract Dev, Security Reviewer, External Auditor (pending).
