# Cross-Contract Authorization Matrix — tycoon-reward-system

**Issue:** #1025
**Contract:** `contract/contracts/tycoon-reward-system/src/lib.rs`
**SDK:** soroban-sdk 23

This document audits every entrypoint of `TycoonRewardSystem` against (a) the
authorization it enforces and (b) the cross-contract calls it makes. It is the
authoritative reference for who may invoke each function and which external
contracts the reward system trusts.

---

## 1. Entrypoint Authorization Matrix

| Entrypoint | Caller(s) allowed | Auth enforced | Privileged role source |
|---|---|---|---|
| `initialize` | Anyone, once | None — one-time guard on `DataKey::Admin` presence | n/a (sets `Admin`) |
| `migrate` | Admin | `admin.require_auth()` | `DataKey::Admin` |
| `pause` | Admin | `admin.require_auth()` | `DataKey::Admin` |
| `unpause` | Admin | `admin.require_auth()` | `DataKey::Admin` |
| `set_backend_minter` | Admin | `admin.require_auth()` | `DataKey::Admin` |
| `clear_backend_minter` | Admin | `admin.require_auth()` | `DataKey::Admin` |
| `mint_voucher` | Admin **or** backend minter | `caller.require_auth()` + `caller == admin \|\| backend_minter == Some(caller)` | `DataKey::Admin`, `DataKey::BackendMinter` |
| `redeem_voucher` | — | Deprecated; always panics (`Use redeem_voucher_from instead`) | n/a |
| `redeem_voucher_from` | Voucher owner | `redeemer.require_auth()` | caller identity |
| `withdraw_funds` | Admin | `admin.require_auth()` | `DataKey::Admin` |
| `transfer` | Voucher owner | `from.require_auth()` | caller identity |
| `get_backend_minter` | Anyone | None (read-only) | n/a |
| `get_balance` | Anyone | None (read-only) | n/a |
| `owned_token_count` | Anyone | None (read-only) | n/a |

Internal helpers `_mint`, `_burn`, and `balance_of` are not `pub` and are only
reachable through the authorized entrypoints above.

---

## 2. Cross-Contract Call Matrix

The reward system makes outbound calls only to the SEP-41 token contracts it
was initialized with (`TycToken`, `UsdcToken`).

| Calling entrypoint | Target contract | Call | Source authority | Guard |
|---|---|---|---|---|
| `redeem_voucher_from` | `TycToken` | `transfer(contract, redeemer, tyc_value)` | `current_contract_address()` (self-auth) | Voucher burned before transfer (CEI); pause check |
| `withdraw_funds` | `token` (must equal `TycToken` or `UsdcToken`) | `transfer(contract, to, amount)` | `current_contract_address()` (self-auth) | Token allowlist + contract balance check |

Notes:

- Both outbound transfers move funds **out of** the contract, so the contract
  authorizes itself as the source via `current_contract_address()`; no external
  caller can spoof this authority.
- `withdraw_funds` rejects any token not in the `{TycToken, UsdcToken}`
  allowlist (`Invalid token: not in allowlist`), preventing the admin from
  draining arbitrary tokens routed through the contract.
- `redeem_voucher_from` follows checks-effects-interactions: the voucher is
  burned and validated before the token transfer, and the `VoucherValue` entry
  is removed after a successful transfer.

---

## 3. Trust Boundaries

- **Admin key** (`DataKey::Admin`) is the root of trust: it is set once at
  `initialize` and gates all privileged configuration, pausing, minting,
  migration, and withdrawals.
- **Backend minter** (`DataKey::BackendMinter`) is an optional, admin-managed
  delegate scoped to a single capability: minting vouchers. It cannot pause,
  withdraw, migrate, or rotate keys.
- **Token contracts** (`TycToken`, `UsdcToken`) are external dependencies fixed
  at `initialize`. The reward system trusts them for value transfer only and
  never grants them authority over its own state.

---

## 4. Test Coverage

The authorization rules above are exercised by the existing suites:

- `admin_access_control_tests.rs` — admin-gated entrypoints and backend-minter
  authorization paths.
- `transfer_tests.rs` — voucher-owner-gated `transfer`.
- `test.rs` / `simulation_scenarios.rs` — mint/redeem flows including the
  cross-contract token transfer in `redeem_voucher_from`.

No API changed; this audit documents existing behavior only.
