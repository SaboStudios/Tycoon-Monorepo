# tycoon-collectibles

Soroban smart contract for Tycoon game collectibles. Implements multi-token balances, a shop with TYC/USDC payment, perk-based burn mechanics, backend reward minting, on-chain metadata, and gas-safe enumeration.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Public Interface](#public-interface)
  - [Lifecycle](#lifecycle)
  - [Shop Administration](#shop-administration)
  - [Purchasing](#purchasing)
  - [Token Operations](#token-operations)
  - [Perk Mechanics](#perk-mechanics)
  - [Backend Minting](#backend-minting)
  - [Metadata](#metadata)
  - [Enumeration](#enumeration)
  - [View Functions](#view-functions)
- [Perk Reference](#perk-reference)
- [Error Reference](#error-reference)
- [Events](#events)
- [Storage Layout](#storage-layout)
- [Security Model](#security-model)
- [Building and Testing](#building-and-testing)
- [Usage Examples](#usage-examples)

---

## Overview

`tycoon-collectibles` is a Soroban contract that manages semi-fungible collectible tokens for the Tycoon board game. Each token type (`token_id`) carries a **perk** and optional **strength** value. Players buy collectibles from an on-chain shop, hold them in their wallet, and burn them to activate the perk effect. The contract also supports backend-minted reward collectibles and marketplace-compatible on-chain metadata.

Key design decisions:

- **CEI pattern** — all state mutations happen before external token transfers in `buy_collectible_from_shop`.
- **No oracle or privileged off-chain price feed** — prices are set by the admin directly.
- **Swap-remove enumeration** — O(1) add/remove from per-owner token lists.
- **Paginated reads** — `MAX_PAGE_SIZE = 100` keeps return values well under the 16.4 KB Soroban limit.

---

## Architecture

```
src/
├── lib.rs          # Contract entry points (TycoonCollectibles)
├── types.rs        # Perk enum, CollectibleMetadata, ShopConfig, CollectiblePrice, BaseURIConfig
├── errors.rs       # CollectibleError enum
├── events.rs       # Event emission helpers
├── storage.rs      # All persistent / instance storage helpers
├── transfer.rs     # _safe_mint, _safe_burn, _safe_transfer, _safe_batch_transfer (stub)
├── enumeration.rs  # Indexed ownership tracking and pagination
└── test.rs         # Unit tests
```

---

## Public Interface

### Lifecycle

#### `initialize(env, admin: Address) → Result<(), CollectibleError>`

Initializes the contract. Sets the admin and state version to 1. Fails with `AlreadyInitialized` if called again.

#### `migrate(env) → Result<(), CollectibleError>`

Admin-only. Migrates state from version 0 → 1. No-op if already at version 1. Extend this function for future schema migrations.

---

### Shop Administration

All shop admin functions require the stored admin's authorization.

#### `init_shop(env, tyc_token: Address, usdc_token: Address) → Result<(), CollectibleError>`

Configures the payment tokens for the shop. Must be called before any purchases.

#### `set_fee_config(env, platform_fee_bps, creator_fee_bps, pool_fee_bps, platform_address, pool_address) → Result<(), CollectibleError>`

Sets the fee split for shop purchases (basis points). Fees are distributed on every `buy_collectible_from_shop` call. If no fee config is set, the full price goes to the contract.

| Parameter | Description |
|---|---|
| `platform_fee_bps` | Basis points sent to `platform_address` |
| `creator_fee_bps` | Basis points sent to the admin (shop creator) |
| `pool_fee_bps` | Basis points sent to `pool_address` |

#### `stock_shop(env, amount, perk, strength, tyc_price, usdc_price) → Result<u128, CollectibleError>`

Creates a new collectible type, mints `amount` units to the contract address (shop inventory), and returns the new `token_id`. Token IDs are assigned sequentially starting from 1.

Validation:
- `amount > 0`
- `perk` in range 0–11
- For `CashTiered` and `TaxRefund` perks: `strength` in 1–5

#### `restock_collectible(env, token_id, additional_amount) → Result<(), CollectibleError>`

Mints additional units of an existing collectible to the shop inventory.

#### `update_collectible_prices(env, token_id, new_tyc_price, new_usdc_price) → Result<(), CollectibleError>`

Updates the TYC and USDC prices for an existing collectible.

#### `set_collectible_for_sale(env, token_id, tyc_price, usdc_price, stock) → Result<(), CollectibleError>`

Low-level admin setter: directly writes price and stock for a token. Useful for bootstrapping or corrections.

---

### Purchasing

#### `buy_collectible_from_shop(env, buyer: Address, token_id, use_usdc: bool) → Result<(), CollectibleError>`

Purchases one unit of `token_id` from the shop. Requires buyer authorization.

**CEI order:**
1. **Checks** — validates shop config, price > 0, stock ≥ 1.
2. **Effects** — decrements stock, mints 1 unit to buyer.
3. **Interactions** — transfers payment token(s) to fee recipients and/or contract.

If a fee config is set, the price is split among `platform_address`, `pool_address`, and admin (creator share). Any residue goes to the contract.

Errors: `ShopNotInitialized`, `ZeroPrice`, `InsufficientStock`.

#### `buy_collectible(env, buyer: Address, token_id, amount) → Result<(), CollectibleError>`

Direct mint (no payment). Requires buyer authorization. Intended for testing or privileged flows.

---

### Token Operations

#### `transfer(env, from: Address, to: Address, token_id, amount) → Result<(), CollectibleError>`

Transfers `amount` units of `token_id` from `from` to `to`. Requires `from` authorization.

#### `burn(env, owner: Address, token_id, amount) → Result<(), CollectibleError>`

Burns `amount` units from `owner`. Requires owner authorization.

---

### Perk Mechanics

#### `burn_collectible_for_perk(env, caller: Address, token_id) → Result<(), CollectibleError>`

Burns 1 unit of `token_id` and activates its perk. Requires caller authorization.

- Fails with `ContractPaused` if the contract is paused.
- Fails with `InsufficientBalance` if caller holds 0 of this token.
- Fails with `InvalidPerk` if the token's perk is `None`.
- For `CashTiered` / `TaxRefund`: validates strength 1–5, emits `perk/cash` event with the cash value from `CASH_TIERS`.
- For all other perks: emits `perk/activate` event (game server listens and applies the effect).

#### `set_token_perk(env, admin: Address, token_id, perk: Perk, strength) → Result<(), CollectibleError>`

Admin-only. Sets the perk and strength for a token type.

#### `set_pause(env, admin: Address, paused: bool) → Result<(), CollectibleError>`

Admin-only. Pauses or unpauses the contract. Only `burn_collectible_for_perk` is gated by the pause flag.

---

### Backend Minting

#### `set_backend_minter(env, new_minter: Address) → Result<(), CollectibleError>`

Admin-only. Designates a backend service address that can call `backend_mint` and `mint_collectible`. Emits a `minter/set` event.

#### `backend_mint(env, caller: Address, to: Address, token_id, amount) → Result<(), CollectibleError>`

Mints `amount` of an existing `token_id` to `to`. Caller must be admin or the registered minter.

#### `mint_collectible(env, caller: Address, to: Address, perk: u32, strength: u32) → Result<u128, CollectibleError>`

Creates a new collectible token type (ID in the `2_000_000_000+` range), sets its perk and strength, mints 1 unit to `to`, and returns the new `token_id`. Caller must be admin or the registered minter.

Validation:
- `perk` in 1–11 (0 = `None` is rejected)
- For `CashTiered` / `TaxRefund`: `strength` in 1–5

---

### Metadata

#### `set_base_uri(env, base_uri: String, uri_type: u32, frozen: bool) → Result<(), CollectibleError>`

Admin-only. Sets the base URI used to construct `token_uri`. `uri_type`: 0 = HTTPS, 1 = IPFS. If `frozen = true`, no further metadata changes are allowed.

#### `base_uri_config(env) → Option<BaseURIConfig>`

Returns the current base URI configuration.

#### `set_token_metadata(env, token_id, name, description, image, animation_url, external_url, attributes) → Result<(), CollectibleError>`

Admin-only. Stores ERC-721-compatible metadata for a token. Fails if metadata is frozen or the token does not exist.

#### `token_metadata(env, token_id) → Option<CollectibleMetadata>`

Returns stored metadata for a token, or `None` if not set.

#### `token_uri(env, token_id) → String`

Returns `base_uri + token_id` as a string. Panics if the token does not exist. Returns an empty string if no base URI is configured.

#### `is_metadata_frozen(env) → bool`

Returns whether metadata is currently frozen.

---

### Enumeration

#### `tokens_of(env, owner: Address) → Vec<u128>`

Returns all token IDs owned by `owner` (no pagination). Use for small collections only.

#### `owned_token_count(env, owner: Address) → u32`

Returns the number of distinct token types owned.

#### `token_of_owner_by_index(env, owner: Address, index: u32) → u128`

Returns the token ID at `index` in the owner's list. Panics if out of bounds.

#### `tokens_of_owner_page(env, owner: Address, page: u32, page_size: u32) → Result<Vec<u128>, CollectibleError>`

Returns a page of token IDs. `page_size` must be in 1–100. Returns an empty vec for out-of-bounds pages.

#### `iterate_owned_tokens(env, owner: Address, start_index: u32, batch_size: u32) → Result<(Vec<u128>, bool), CollectibleError>`

Returns a batch starting at `start_index` and a `has_more` flag. Use this for iterating large collections without hitting gas limits.

#### `max_page_size(env) → u32`

Returns `100` (the compile-time constant `MAX_PAGE_SIZE`).

---

### View Functions

| Function | Returns |
|---|---|
| `balance_of(owner, token_id)` | `u64` — token balance |
| `get_stock(token_id)` | `u64` — shop inventory |
| `get_token_perk(token_id)` | `Perk` |
| `get_token_strength(token_id)` | `u32` |
| `is_contract_paused()` | `bool` |
| `get_backend_minter()` | `Option<Address>` |

---

## Perk Reference

| Value | Variant | Strength | Cash Tiers |
|---|---|---|---|
| 0 | `None` | — | — |
| 1 | `CashTiered` | 1–5 | 100, 250, 500, 1000, 2500 |
| 2 | `TaxRefund` | 1–5 | 100, 250, 500, 1000, 2500 |
| 3 | `RentBoost` | any | — |
| 4 | `PropertyDiscount` | any | — |
| 5 | `ExtraTurn` | any | — |
| 6 | `JailFree` | any | — |
| 7 | `DoubleRent` | any | — |
| 8 | `RollBoost` | any | — |
| 9 | `Teleport` | any | — |
| 10 | `Shield` | any | — |
| 11 | `RollExact` | any | — |

Perks 3–11 emit a `perk/activate` event on burn; the game server is responsible for applying the effect. Perks 1–2 additionally emit a `perk/cash` event with the resolved cash value.

---

## Error Reference

| Code | Variant | Meaning |
|---|---|---|
| 1 | `AlreadyInitialized` | `initialize` called more than once |
| 2 | `InsufficientBalance` | Caller holds fewer tokens than requested |
| 3 | `InvalidAmount` | Amount is zero |
| 4 | `Unauthorized` | Caller is not admin or minter |
| 5 | `TokenIdMismatch` | Batch arrays have different lengths |
| 6 | `ZeroPrice` | Token price is zero or not set |
| 7 | `InsufficientStock` | Shop has no remaining inventory |
| 8 | `ShopNotInitialized` | `init_shop` has not been called |
| 9 | `ContractPaused` | Operation blocked while paused |
| 10 | `InvalidPerk` | Perk value out of range or `None` where a real perk is required |
| 11 | `InvalidStrength` | Strength out of 1–5 range for tiered perks |
| 12 | `TokenNotFound` | Token does not exist |
| 13 | `InvalidTokenId` | Reserved |
| 14 | `InvalidPageSize` | Page size is 0 or exceeds `MAX_PAGE_SIZE` |
| 15 | `InvalidURIType` | URI type is not 0 (HTTPS) or 1 (IPFS) |
| 16 | `MetadataFrozen` | Metadata is immutable; changes rejected |

---

## Events

| Topic | Data | Emitted by |
|---|---|---|
| `(transfer, from, to)` | `(token_id, amount)` | `_safe_transfer` |
| `(mint,)` | `(to, token_id, amount)` | `_safe_mint` |
| `(burn, coll, burner)` | `(token_id, perk, strength)` | `burn_collectible_for_perk` |
| `(perk, cash, activator)` | `(token_id, cash_value)` | `burn_collectible_for_perk` (tiered perks) |
| `(perk, activate, activator)` | `(token_id, perk, strength)` | `burn_collectible_for_perk` (non-tiered perks) |
| `(coll_buy, buyer)` | `(token_id, price, use_usdc)` | `buy_collectible_from_shop` |
| `(coll_mint, recipient)` | `(token_id, perk, strength)` | `mint_collectible` |
| `(stock, new)` | `(token_id, amount, perk, strength, tyc_price, usdc_price)` | `stock_shop` |
| `(restock,)` | `(token_id, additional_amount, new_total)` | `restock_collectible` |
| `(price, update)` | `(token_id, new_tyc_price, new_usdc_price)` | `update_collectible_prices` |
| `(fee_dist, token_id)` | `(platform, platform_amount, pool, pool_amount, creator_amount)` | `buy_collectible_from_shop` |
| `(minter, set)` | `new_minter` | `set_backend_minter` |

---

## Storage Layout

| Key pattern | Storage tier | Description |
|---|---|---|
| `"ADMIN"` | Instance | Contract admin address |
| `"MINTER"` | Instance | Backend minter address |
| `"PAUSED"` | Instance | Pause flag |
| `"STATE_VER"` | Instance | Schema version |
| `"SHOP_CFG"` | Instance | `ShopConfig` (TYC + USDC token addresses) |
| `"FEE_CFG"` | Instance | `FeeConfig` |
| `"BASE_URI"` | Instance | `BaseURIConfig` |
| `"NEXT_TID"` | Instance | Next token ID counter |
| `("BAL", owner, token_id)` | Persistent | Token balance per owner |
| `("PERK", token_id)` | Persistent | Perk enum for token |
| `("STRENGTH", token_id)` | Persistent | Strength value for token |
| `("PRICE", token_id)` | Persistent | `CollectiblePrice` |
| `("STOCK", token_id)` | Persistent | Shop inventory count |
| `("OWNED", owner)` | Persistent | `Vec<u128>` of owned token IDs |
| `("TIDX", owner, token_id)` | Persistent | Index of token in owner's Vec |
| `("META", token_id)` | Persistent | `CollectibleMetadata` |

Reward collectibles minted via `mint_collectible` use IDs ≥ `2_000_000_000`. Shop collectibles use IDs starting from 1.

---

## Security Model

- **Admin authorization** is enforced via `admin.require_auth()` on all privileged functions.
- **CEI pattern** in `buy_collectible_from_shop` prevents re-entrancy: stock is decremented and the collectible is minted to the buyer *before* any token transfer calls.
- **No unaudited oracle or privileged pattern** — prices are set by the admin; there is no external price feed.
- **Pause mechanism** allows the admin to halt perk burns in an emergency without affecting transfers or purchases.
- **Metadata freeze** makes token metadata immutable once finalized, preventing rug-pull metadata changes.

---

## Building and Testing

```bash
# Check the workspace (must pass for CI)
cargo check --package tycoon-collectibles

# Run all unit tests
cargo test --package tycoon-collectibles

# Build optimized WASM
cargo build --release --target wasm32-unknown-unknown --package tycoon-collectibles
```

The optimized WASM is written to:
```
target/wasm32-unknown-unknown/release/tycoon_collectibles.wasm
```

---

## Usage Examples

```rust
// 1. Initialize
client.initialize(&admin);

// 2. Configure shop
client.init_shop(&tyc_token, &usdc_token);
client.set_fee_config(&500, &200, &100, &platform_addr, &pool_addr); // 5% platform, 2% creator, 1% pool

// 3. Stock a collectible (CashTiered, strength 3, 100 units)
let token_id = client.stock_shop(&100, &1, &3, &1000, &500);

// 4. Player buys with TYC
client.buy_collectible_from_shop(&player, &token_id, &false);

// 5. Player burns for perk
client.burn_collectible_for_perk(&player, &token_id);

// 6. Backend mints a reward collectible
client.set_backend_minter(&backend_service);
let reward_id = client.mint_collectible(&backend_service, &player, &5, &1); // ExtraTurn

// 7. Paginate player's inventory
let page = client.tokens_of_owner_page(&player, &0, &50);
```
