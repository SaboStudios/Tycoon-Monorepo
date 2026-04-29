# Acceptance Criteria — tycoon-game (SW-CT-010)

Stellar Wave · Contract (Soroban / Stellar)
Issue: SW-CT-010

---

## Functional Acceptance Criteria

### Lifecycle

- [x] `initialize` stores `tyc_token`, `usdc_token`, `initial_owner`, and `reward_system`; sets `state_version` to `1` and marks the contract as initialized.
  - A second call panics with `"Contract already initialized"`.
  - `initial_owner.require_auth()` is enforced.
- [x] `admin_migrate` is admin-only and advances `state_version` from `0` → `1`; calling it when already at version `1` is a no-op (no panic, no version change).

### Admin-Only Entrypoints

All admin functions must reject callers that are not the stored `owner` (enforced via `require_admin`).

- [x] `admin_withdraw_funds` transfers TYC or USDC from the contract to `to`.
  - Panics with `"Invalid token address"` when `token` is not TYC or USDC.
  - Panics with `"Insufficient contract balance"` when the contract holds less than `amount`.
  - Emits `FundsWithdrawn` event with correct `token`, `to`, and `amount`.
  - CEI order: balance check happens before `token.transfer`.
- [x] `admin_set_collectible_info` stores a `CollectibleInfo` entry keyed by `token_id`; subsequent calls overwrite the previous entry.
- [x] `admin_set_cash_tier_value` stores a `u128` value keyed by `tier`; subsequent calls overwrite the previous value.
- [x] `admin_set_game_controller` stores the `new_controller` address as `BackendGameController`.
- [x] `admin_mint_registration_voucher` invokes `mint_voucher` on the reward system contract with the player address and a `2 TYC` amount.

### Public Entrypoints

- [x] `register_player` stores a `User` struct for `caller` and marks the address as registered.
  - Requires `caller.require_auth()`.
  - Panics with `"Address already registered"` on duplicate registration.
  - Panics with `"Username must be 3-20 characters"` for usernames shorter than 3 or longer than 20 characters.
  - Accepts usernames of exactly 3 characters (lower boundary).
  - Accepts usernames of exactly 20 characters (upper boundary).
  - Stored `User` has `games_played = 0` and `games_won = 0` on registration.
- [x] `remove_player_from_game` emits `PlayerRemovedFromGame` with correct `game_id`, `player`, and `turn_count`.
  - Requires `caller.require_auth()`.
  - Accepts the stored `owner` as caller.
  - Accepts the stored `backend_game_controller` as caller.
  - Panics with `"Unauthorized: caller must be owner or backend game controller"` for any other caller.
  - Panics with the same message when no `backend_game_controller` has been set and caller is not the owner.
- [x] `get_user` returns `Some(User)` for a registered address and `None` for an unregistered address.
- [x] `get_collectible_info` returns the stored `(perk, strength, tyc_price, usdc_price, shop_stock)` tuple.
  - Panics with `"Collectible does not exist"` for an unknown `token_id`.
- [x] `get_cash_tier_value` returns the stored `u128` value for a tier.
  - Panics with `"Cash tier does not exist"` for an unknown `tier`.
- [x] `export_state` returns a `ContractStateDump` reflecting the current `owner`, `tyc_token`, `usdc_token`, `reward_system`, `state_version`, `is_initialized`, and `backend_controller`.
  - No auth required.
  - `backend_controller` is `None` before `admin_set_game_controller` is called.
  - `backend_controller` is `Some(address)` after `admin_set_game_controller` is called.

### Deprecated Shims

- [x] `migrate` delegates to `admin_migrate` and produces identical behavior.
- [x] `withdraw_funds` delegates to `admin_withdraw_funds` and produces identical behavior.
- [x] `set_collectible_info` delegates to `admin_set_collectible_info` and produces identical behavior.
- [x] `set_cash_tier_value` delegates to `admin_set_cash_tier_value` and produces identical behavior.
- [x] `set_backend_game_controller` delegates to `admin_set_game_controller` and produces identical behavior.
- [x] `mint_registration_voucher` delegates to `admin_mint_registration_voucher` and produces identical behavior.

---

## Treasury Invariant

- [x] `TreasurySnapshot::invariant_holds` returns `true` when `sum_of_balances + escrow == liabilities + treasury`.
- [x] `TreasurySnapshot::invariant_holds` returns `false` when the invariant is violated.
- [x] `TreasurySnapshot::invariant_holds` returns `false` on arithmetic overflow (does not panic).
- [x] `TreasurySnapshot::assert_invariant` does not panic when the invariant holds.
- [x] `TreasurySnapshot::assert_invariant` panics with `"Treasury invariant violated"` when the invariant is broken.
- [x] Locking funds into escrow (`sum_of_balances -= x; escrow += x`) preserves the invariant.
- [x] Releasing escrow back to balances (`escrow -= x; sum_of_balances += x`) preserves the invariant.
- [x] Reclassifying a liability to treasury (`liabilities -= x; treasury += x`) preserves the invariant.

---

## Non-Functional Acceptance Criteria

- [x] `cargo check --package tycoon-game` passes with no errors or warnings.
- [x] `cargo test --package tycoon-game` passes (all tests green).
- [x] No unaudited oracle or privileged off-chain price feed in production paths.
- [x] CEI pattern enforced in `admin_withdraw_funds`.
- [x] All admin functions enforce `require_auth()` via the shared `require_admin` helper.
- [x] `#[no_std]` — no standard library dependency in the contract crate.
- [x] `overflow-checks = true` and `panic = "abort"` in the release profile (workspace `Cargo.toml`).
- [x] Deprecated shims carry `#[deprecated(since = "0.2.0")]` annotations.

---

## Test Coverage Checklist

| Area | Test(s) |
|---|---|
| Initialize (success) | `test_initialize_success` |
| Initialize (double-init guard) | `test_initialize_twice_fails` |
| Withdraw TYC (success) | `test_withdraw_tyc_by_owner_success` |
| Withdraw USDC (success) | `test_withdraw_usdc_by_owner_success` |
| Withdraw (insufficient balance) | `test_withdraw_insufficient_balance_fails` |
| Withdraw (invalid token) | `test_withdraw_invalid_token_fails` |
| Withdraw (event emission) | `test_withdraw_emits_event` |
| Treasury invariant (zero state) | `test_treasury_invariant_balanced_zero_state` |
| Treasury invariant (typical state) | `test_treasury_invariant_balanced_typical_state` |
| Treasury invariant (escrow-heavy) | `test_treasury_invariant_balanced_escrow_heavy_state` |
| Treasury invariant (violated) | `test_treasury_invariant_unbalanced_returns_false` |
| Treasury invariant (zero treasury) | `test_treasury_invariant_unbalanced_zero_treasury` |
| Treasury assert (no panic) | `test_treasury_invariant_assert_does_not_panic_when_balanced` |
| Treasury assert (panics) | `test_treasury_invariant_assert_panics_when_unbalanced` |
| Treasury escrow lock | `test_treasury_invariant_lock_into_escrow_preserves_invariant` |
| Treasury escrow release | `test_treasury_invariant_release_escrow_back_to_balances_preserves_invariant` |
| Treasury liability reclassify | `test_treasury_invariant_reclassify_liability_to_treasury_preserves_invariant` |
| Treasury generated scenarios | `test_treasury_invariant_generated_scenarios_pass` |
| Get collectible (success) | `test_get_collectible_info_success` |
| Get collectible (nonexistent) | `test_get_collectible_info_nonexistent` |
| Get cash tier (success) | `test_get_cash_tier_value_success` |
| Get cash tier (invalid tier) | `test_get_cash_tier_value_invalid_tier` |
| Full contract flow | `test_full_contract_flow` |
| Register player (success) | `test_register_player_success` |
| Register player (duplicate) | `test_register_player_duplicate` |
| Register player (username too short) | `test_register_player_username_too_short` |
| Register player (username too long) | `test_register_player_username_too_long` |
| Register player (exactly 3 chars) | `test_register_player_username_exactly_3_chars` |
| Register player (exactly 20 chars) | `test_register_player_username_exactly_20_chars` |
| Get user (unregistered) | `test_get_user_unregistered_returns_none` |
| Set collectible (overwrite) | `test_set_collectible_info_overwrite` |
| Set backend controller | `test_set_backend_game_controller_by_owner` |
| Remove player (by owner) | `test_remove_player_from_game_by_owner` |
| Remove player (by backend controller) | `test_remove_player_from_game_by_backend_controller` |
| Remove player (unauthorized) | `test_remove_player_from_game_unauthorized` |
| Remove player (no controller set) | `test_remove_player_from_game_no_backend_controller_set` |
| Remove player (event emission) | `test_remove_player_emits_correct_event` |
| Backend controller integration | `test_backend_controller_integration` |
| Export state (initialized values) | `test_export_state_reflects_initialized_values` |
| Export state (backend controller) | `test_export_state_reflects_backend_controller_after_set` |
| Migrate (idempotent at v1) | `test_migrate_is_idempotent_at_version_1` |
| Migrate (v0 → v1) | `test_migrate_from_v0_to_v1` |
| Admin access control (ACT-01 – ACT-13) | `admin_access_control_tests` module |
| Deprecated entrypoints | `deprecated_entrypoints_tests` module |
| Simulation scenarios (SIM-01 – SIM-20) | `simulation_scenarios` module |

---

## Rollout / Migration Notes

1. **No schema migration required** for this PR — only documentation and acceptance criteria are added; no on-chain state is modified.
2. If deploying a fresh instance:
   - Call `initialize(tyc_token, usdc_token, owner, reward_system)` once.
   - Call `admin_set_game_controller(backend_service)` to enable the backend controller role.
   - Call `admin_set_collectible_info` for each collectible type.
   - Call `admin_set_cash_tier_value` for each cash tier.
3. If upgrading an existing deployment at state version 0:
   - Call `admin_migrate` once after the WASM upgrade to advance to version 1.
4. Deprecated entrypoints (`migrate`, `withdraw_funds`, `set_collectible_info`, `set_cash_tier_value`, `set_backend_game_controller`, `mint_registration_voucher`) remain in the ABI through v0.x. They will be removed in v1.0.0. Integrators must migrate to the `admin_*` variants before the v1.0.0 release.
5. The `owner` key cannot be rotated post-deploy (open item OI-2 in `SECURITY_REVIEW_CHECKLIST.md`). Secure the owner key before calling `initialize` on mainnet.
6. The `reward_system` address is immutable post-deploy. Ensure it is audited before calling `initialize` on mainnet (open item OI-5).

---

## References

- Stellar Wave batch issue: SW-CT-010
- Related contracts: `tycoon-reward-system` (called by `admin_mint_registration_voucher`), `tycoon-collectibles` (uses collectible metadata), `tycoon-token` (TYC payment token)
- Related docs: `SECURITY_REVIEW_CHECKLIST.md`, `CHANGELOG.md`, `contract/docs/STORAGE_ECONOMICS.md`
