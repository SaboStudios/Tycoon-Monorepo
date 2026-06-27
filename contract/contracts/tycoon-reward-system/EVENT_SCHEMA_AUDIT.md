# Event Schema / `contractevent` Audit — tycoon-reward-system

**Issue:** #1026
**Contract:** `contract/contracts/tycoon-reward-system/src/lib.rs`
**SDK:** soroban-sdk 23

This document is the authoritative schema for every event published by
`TycoonRewardSystem`. Off-chain indexers and the backend MUST treat the topic
tuples and data payloads below as the stable contract surface.

---

## 1. Event Catalog

| Event | Topics (in order) | Data payload | Emitting fn |
|---|---|---|---|
| `Paused` | (`Paused`: Symbol) | `true`: bool | `pause` |
| `Unpaused` | (`Unpaused`: Symbol) | `false`: bool | `unpause` |
| `set_min` | (`set_min`: Symbol, `new_minter`: Address) | `()` | `set_backend_minter` |
| `clr_min` | (`clr_min`: Symbol) | `()` | `clear_backend_minter` |
| `V_Mint` | (`V_Mint`: Symbol, `to`: Address, `token_id`: u128) | `tyc_value`: u128 | `mint_voucher` |
| `Mint` | (`Mint`: Symbol, `to`: Address, `token_id`: u128) | `amount`: u64 | `_mint` (mint/transfer paths) |
| `Burn` | (`Burn`: Symbol, `from`: Address, `token_id`: u128) | `amount`: u64 | `_burn` (redeem/transfer paths) |
| `Redeem` | (`Redeem`: Symbol, `redeemer`: Address, `token_id`: u128) | `tyc_value`: u128 | `redeem_voucher_from` |
| `FundsWithdrawn` | (`FundsWithdrawn`: Symbol, `token`: Address, `to`: Address) | `amount`: u128 | `withdraw_funds` |
| `Transfer` | (`Transfer`: Symbol, `from`: Address, `to`: Address, `token_id`: u128) | `amount`: u64 | `transfer` |

---

## 2. Emission Notes

- **Symbol length.** Topics emitted via `symbol_short!` are capped at 9
  characters, which is why minter events use the abbreviated tags `set_min` /
  `clr_min`. `FundsWithdrawn` exceeds 9 characters and is therefore built with
  `Symbol::new(&e, "FundsWithdrawn")`.
- **Composite operations emit layered events.** `mint_voucher` emits both the
  internal `Mint` (from `_mint`) and the semantic `V_Mint`. `transfer` emits the
  internal `Burn` + `Mint` plus the semantic `Transfer`. `redeem_voucher_from`
  emits the internal `Burn` plus the semantic `Redeem`. Indexers should key on
  the semantic event for business logic and treat `Mint`/`Burn` as ledger-level
  balance deltas.
- **Ordering (CEI).** Every event is published *after* the corresponding state
  mutation, and — for `redeem_voucher_from` — after the external token transfer
  completes, so an observed event always reflects committed state.
- **Deprecated publish API.** All `publish` calls are intentionally annotated
  with `#[allow(deprecated)]` to pin the current tuple-topic event format; this
  is a deliberate, audited choice and not an oversight.
- **Zero-amount no-ops.** `_mint` and `_burn` return early when `amount == 0`,
  so no `Mint`/`Burn` event is emitted for a zero-amount call — consumers will
  never see a zero-delta balance event.

---

## 3. Stability Contract

- Topic tags and their ordinal positions are **frozen**; renaming a tag or
  reordering topics is a breaking change for indexers and requires a version
  bump (see `DataKey::StateVersion`).
- Data payload integer widths are part of the schema: voucher value events use
  `u128`; balance-delta events use `u64`.

---

## 4. Test Coverage

Event emission is exercised by the existing snapshot and unit suites:

- `test.rs` — `test_events` and the snapshot fixtures under
  `test_snapshots/test/` (e.g. `test_events.1.json`, `test_mint.1.json`,
  `test_burn.1.json`) pin the emitted topics and data.
- `admin_access_control_tests.rs` / `transfer_tests.rs` — exercise the paths
  that emit `set_min`/`clr_min`, `Paused`/`Unpaused`, and `Transfer`.

No API changed; this audit documents existing behavior only.
