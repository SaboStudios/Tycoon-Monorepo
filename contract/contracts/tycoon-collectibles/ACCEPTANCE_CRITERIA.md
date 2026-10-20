# Acceptance Criteria — tycoon-collectibles (SW-CT-022)

Stellar Wave · Contract (Soroban / Stellar)
Issue: SW-CT-022

---

## Functional Acceptance Criteria

### Lifecycle

- [x] `initialize` sets the admin and state version; a second call returns `AlreadyInitialized`.
- [x] `migrate` is admin-only and advances state version from 0 → 1 without error; calling it when already at version 1 is a no-op.

### Shop Administration

- [x] `init_shop` stores TYC and USDC token addresses; subsequent calls overwrite the config.
- [x] `set_fee_config` stores fee split in basis points; used on every `buy_collectible_from_shop` call.
- [x] `stock_shop` creates a new token type, mints inventory to the contract address, and returns the sequential `token_id`.
  - Rejects `amount == 0` with `InvalidAmount`.
  - Rejects `perk > 11` with `InvalidPerk`.
  - Rejects `CashTiered` / `TaxRefund` with `strength` outside 1–5 with `InvalidStrength`.
  - Emits `(stock, new)` event.
- [x] `restock_collectible` adds inventory to an existing token.
  - Rejects `additional_amount == 0` with `InvalidAmount`.
  - Rejects non-existent `token_id` with `TokenNotFound`.
  - Emits `(restock,)` event.
- [x] `update_collectible_prices` updates TYC and USDC prices for an existing token.
  - Rejects non-existent `token_id` with `TokenNotFound`.
  - Emits `(price, update)` event.

### Purchasing

- [x] `buy_collectible_from_shop` decrements shop stock, mints 1 unit to buyer, and transfers payment.
  - Fails with `ShopNotInitialized` if `init_shop` was never called.
  - Fails with `ZeroPrice` if the selected currency price is ≤ 0.
  - Fails with `InsufficientStock` if stock is 0.
  - When a fee config is set, distributes payment to platform, pool, and creator addresses.
  - Emits `(coll_buy, buyer)` event.
  - Emits `(fee_dist, token_id)` event when fee config is present.
  - State mutations (stock decrement, mint) happen **before** external token transfers (CEI).

### Token Operations

- [x] `transfer` moves balance from `from` to `to`; requires `from` authorization.
  - Fails with `InsufficientBalance` if `from` holds fewer tokens than requested.
  - Fails with `InvalidAmount` if `amount == 0`.
  - Updates enumeration: removes `token_id` from `from` when balance reaches 0; adds to `to` when balance was 0.
- [x] `burn` reduces balance; requires owner authorization.
  - Removes token from enumeration when balance reaches 0.

### Perk Mechanics

- [x] `burn_collectible_for_perk` burns 1 unit and emits the appropriate perk event.
  - Fails with `ContractPaused` when paused.
  - Fails with `InsufficientBalance` when caller holds 0.
  - Fails with `InvalidPerk` when token perk is `None`.
  - For `CashTiered` / `TaxRefund`: fails with `InvalidStrength` when strength is outside 1–5; emits `(perk, cash, activator)` with the correct `CASH_TIERS` value.
  - For all other perks (3–11): emits `(perk, activate, activator)`.
  - Emits `(burn, coll, burner)` event after the burn.
- [x] `set_pause` / `is_contract_paused` toggle and reflect pause state; admin-only.
- [x] `set_token_perk` is admin-only; non-admin callers receive `Unauthorized`.

### Backend Minting

- [x] `set_backend_minter` is admin-only; emits `(minter, set)` event.
  - Rejects the contract's own address as minter with `Unauthorized`.
- [x] `backend_mint` allows admin or registered minter to mint; rejects all others with `Unauthorized`.
- [x] `mint_collectible` creates a new token in the `2_000_000_000+` ID range, sets perk/strength, mints 1 unit to recipient.
  - Rejects `perk == 0` with `InvalidPerk`.
  - Rejects `perk > 11` with `InvalidPerk`.
  - Rejects `CashTiered` / `TaxRefund` with `strength` outside 1–5 with `InvalidStrength`.
  - Rejects non-admin/non-minter callers with `Unauthorized`.
  - Sequential IDs increment by 1 per call.
  - Emits `(coll_mint, recipient)` event.

### Metadata

- [x] `set_base_uri` stores base URI and URI type (0 = HTTPS, 1 = IPFS); admin-only.
  - Rejects `uri_type > 1` with `InvalidURIType`.
  - When `frozen = true`, subsequent calls to `set_base_uri` or `set_token_metadata` return `MetadataFrozen`.
- [x] `token_uri` returns `base_uri + token_id`; panics for non-existent tokens; returns empty string when no base URI is set.
- [x] `set_token_metadata` stores ERC-721-compatible metadata; admin-only; respects frozen flag.
- [x] `token_metadata` returns stored metadata or `None`.
- [x] `is_metadata_frozen` reflects the frozen flag.

### Enumeration

- [x] `tokens_of` returns all token IDs for an owner.
- [x] `owned_token_count` returns the count of distinct token types owned.
- [x] `token_of_owner_by_index` returns the token ID at a given index; panics if out of bounds.
- [x] `tokens_of_owner_page` returns a page of token IDs; rejects `page_size == 0` or `page_size > 100` with `InvalidPageSize`; returns empty vec for out-of-bounds pages.
- [x] `iterate_owned_tokens` returns a batch and a `has_more` flag; same size validation as above.
- [x] `max_page_size` returns `100`.
- [x] Enumeration is consistent: no duplicates, no stale entries after burns/transfers.
- [x] Swap-remove algorithm maintains correct indices after removal.

---

## Non-Functional Acceptance Criteria

- [x] `cargo check --package tycoon-collectibles` passes with no errors or warnings.
- [x] `cargo test --package tycoon-collectibles` passes (all tests green).
- [x] No unaudited oracle or privileged off-chain price feed in production paths.
- [x] CEI pattern enforced in `buy_collectible_from_shop`.
- [x] All admin functions use `require_auth()`.
- [x] Pagination capped at `MAX_PAGE_SIZE = 100` (1 600 bytes ≪ 16.4 KB Soroban return-value limit).

---

## Test Coverage Checklist

| Area | Test(s) |
|---|---|
| Initialize / double-init guard | `test_initialize`, `test_initialize_already_initialized` |
| Migrate | `test_migrate` |
| Buy collectible (direct) | `test_buy_collectible_mints_to_buyer` |
| Transfer | `test_transfer_moves_balance`, `test_transfer_insufficient_balance` |
| Burn | `test_burn_removes_balance` |
| Enumeration | `test_enumeration_updates_correctly`, `test_enumeration_swap_remove_behavior`, `test_no_duplicate_entries`, `test_complex_ownership_scenario`, `test_partial_transfers_maintain_enumeration` |
| Shop purchase (TYC) | `test_buy_from_shop_with_tyc` |
| Shop purchase (USDC) | `test_buy_from_shop_with_usdc` |
| Shop purchase (fee distribution) | `test_buy_from_shop_with_fee_distribution` |
| Shop errors | `test_buy_from_shop_insufficient_stock`, `test_buy_from_shop_zero_price`, `test_buy_from_shop_not_initialized` |
| Stock shop | `test_stock_shop_creates_new_collectible`, `test_stock_shop_with_multiple_collectibles`, `test_stock_shop_fails_with_zero_amount`, `test_stock_shop_fails_with_invalid_perk`, `test_stock_shop_fails_with_invalid_strength`, `test_stock_shop_emits_event` |
| Restock | `test_restock_collectible_adds_inventory`, `test_restock_collectible_multiple_times`, `test_restock_fails_with_zero_amount`, `test_restock_fails_with_nonexistent_token`, `test_restock_emits_event` |
| Price update | `test_update_collectible_prices`, `test_update_prices_fails_with_nonexistent_token`, `test_update_prices_emits_event` |
| Perk burn (tiered) | `test_burn_collectible_for_perk_cash_tiered`, `test_burn_collectible_for_perk_all_tiers`, `test_burn_collectible_for_perk_tax_refund` |
| Perk burn (non-tiered) | `test_burn_collectible_for_perk_non_tiered`, `test_burn_collectible_for_perk_property_discount` |
| Perk burn (new perks 5–11) | `test_burn_collectible_for_perk_new_perks` |
| Perk burn (error paths) | `test_burn_collectible_for_perk_insufficient_balance`, `test_burn_collectible_for_perk_invalid_perk_none`, `test_burn_collectible_for_perk_invalid_strength_zero`, `test_burn_collectible_for_perk_invalid_strength_six`, `test_burn_collectible_for_perk_when_paused` |
| Pause / unpause | `test_pause_unpause_functionality` |
| Auth guards | `test_set_token_perk_unauthorized`, `test_set_pause_unauthorized`, `test_set_backend_minter_unauthorized` |
| Backend mint | `test_protected_mint_authorized_roles`, `test_protected_mint_rejection`, `test_enumeration_after_complete_burn` |
| mint_collectible | `test_mint_collectible_success`, `test_mint_collectible_multiple_increments_id`, `test_mint_collectible_invalid_perk_none`, `test_mint_collectible_invalid_perk_too_high`, `test_mint_collectible_invalid_strength_zero_cashtiered`, `test_mint_collectible_invalid_strength_six_taxrefund`, `test_mint_collectible_unauthorized`, `test_mint_collectible_minter_can_mint`, `test_mint_collectible_event_emission`, `test_mint_collectible_non_tiered_perks_no_strength_validation` |
| New perks (5–11) | `test_new_perk_extra_turn` … `test_new_perk_roll_exact`, `test_new_perk_stock_shop`, `test_perk_enum_values` |
| Metadata | `test_base_uri_configuration`, `test_invalid_uri_type`, `test_metadata_frozen_prevents_changes`, `test_token_metadata_setting`, `test_token_uri_generation`, `test_token_uri_nonexistent_token`, `test_metadata_frozen_prevents_metadata_changes` |
| Pagination | `test_pagination_max_page_size`, `test_pagination_basic`, `test_pagination_invalid_page_size`, `test_iterator_pattern`, `test_iterator_invalid_batch_size` |

---

## Rollout / Migration Notes

1. **No schema migration required** for this PR — only documentation and tests are added.
2. If deploying a fresh instance: call `initialize` → `init_shop` → optionally `set_fee_config` → `stock_shop` for each collectible type.
3. If upgrading an existing deployment at state version 0: call `migrate` once after the WASM upgrade to advance to version 1.
4. Metadata can be set at any time before calling `set_base_uri` with `frozen = true`. Once frozen, metadata is immutable.
5. The `backend_minter` role can be rotated by the admin at any time via `set_backend_minter`.

---

## References

- Stellar Wave batch issue: SW-CT-022
- GitHub issue: #611
- Related docs: `METADATA_SCHEMA_AND_MARKETPLACE_INTEGRATION.md`, `GAS_LIMITS_AND_PAGINATION.md`, `ENUMERATION_IMPLEMENTATION.md`
