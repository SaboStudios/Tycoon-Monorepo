# Entrypoint Classification — tycoon-collectibles (SW-CT-024)

All public entrypoints of the `TycoonCollectibles` contract, classified by
authorization requirement. Derived directly from `src/lib.rs`.

---

## Admin-Only Entrypoints

These entrypoints call `get_admin(&env)` followed by `admin.require_auth()`.
Any call that does not carry a valid signature from the stored admin address
will be rejected by the Soroban auth framework.

| Entrypoint | Auth call | Notes |
|---|---|---|
| `initialize(admin)` | `admin.require_auth()` on the *caller-supplied* address | One-time; panics `AlreadyInitialized` on re-call |
| `migrate()` | `admin.require_auth()` | Bumps state version; idempotent |
| `init_shop(tyc_token, usdc_token)` | `admin.require_auth()` | Sets payment token addresses |
| `set_fee_config(platform_fee_bps, creator_fee_bps, pool_fee_bps, platform_address, pool_address)` | `admin.require_auth()` | Configures fee split for shop purchases |
| `stock_shop(amount, perk, strength, tyc_price, usdc_price)` | `admin.require_auth()` | Mints new collectible type to contract inventory |
| `restock_collectible(token_id, additional_amount)` | `admin.require_auth()` | Adds inventory to existing collectible type |
| `update_collectible_prices(token_id, new_tyc_price, new_usdc_price)` | `admin.require_auth()` | Updates prices for an existing collectible |
| `set_collectible_for_sale(token_id, tyc_price, usdc_price, stock)` | `admin.require_auth()` | Direct price + stock setter (no mint) |
| `set_token_perk(token_id, perk, strength)` | `admin.require_auth()` | Overrides perk/strength for any token |
| `set_pause(paused)` | `admin.require_auth()` | Pauses/unpauses perk-burn operations |
| `set_backend_minter(new_minter)` | `admin.require_auth()` | Grants backend-minter role; rejects contract's own address |
| `set_base_uri(base_uri, uri_type, frozen)` | `admin.require_auth()` | Sets metadata base URI; rejected if already frozen |
| `set_token_metadata(token_id, name, description, image, animation_url, external_url, attributes)` | `admin.require_auth()` | Sets per-token metadata; rejected if frozen |

---

## Caller-Authenticated Entrypoints

These entrypoints require the *caller* (not the admin) to authorize the call.
They are open to any address that can provide a valid signature.

| Entrypoint | Auth call | Notes |
|---|---|---|
| `buy_collectible_from_shop(buyer, token_id, use_usdc)` | `buyer.require_auth()` | Requires shop initialized, stock > 0, price > 0 |
| `buy_collectible(buyer, token_id, amount)` | `buyer.require_auth()` | Direct mint; no price check |
| `transfer(from, to, token_id, amount)` | `from.require_auth()` | Fails if `from` has insufficient balance |
| `burn(owner, token_id, amount)` | `owner.require_auth()` | Fails if insufficient balance |
| `burn_collectible_for_perk(caller, token_id)` | `caller.require_auth()` | Fails if paused, no balance, or `Perk::None` |

---

## Dual-Role Entrypoints

These entrypoints accept either the admin or the designated backend minter.

| Entrypoint | Auth call | Notes |
|---|---|---|
| `backend_mint(caller, to, token_id, amount)` | `caller.require_auth()` then checks `caller == admin \|\| caller == minter` | Returns `Unauthorized` if neither |
| `mint_collectible(caller, to, perk, strength)` | `caller.require_auth()` then checks `caller == admin \|\| caller == minter` | Generates new token_id in 2e9+ range; returns `Unauthorized` if neither |

---

## Public Read-Only Entrypoints

No authorization required. Safe to call from any context.

| Entrypoint | Returns |
|---|---|
| `balance_of(owner, token_id)` | `u64` |
| `tokens_of(owner)` | `Vec<u128>` |
| `get_backend_minter()` | `Option<Address>` |
| `get_stock(token_id)` | `u64` |
| `is_contract_paused()` | `bool` |
| `get_token_perk(token_id)` | `Perk` |
| `get_token_strength(token_id)` | `u32` |
| `owned_token_count(owner)` | `u32` |
| `token_of_owner_by_index(owner, index)` | `u128` (panics if out of bounds) |
| `tokens_of_owner_page(owner, page, page_size)` | `Result<Vec<u128>, CollectibleError>` |
| `iterate_owned_tokens(owner, start_index, batch_size)` | `Result<(Vec<u128>, bool), CollectibleError>` |
| `max_page_size()` | `u32` |
| `base_uri_config()` | `Option<BaseURIConfig>` |
| `token_metadata(token_id)` | `Option<CollectibleMetadata>` |
| `token_uri(token_id)` | `String` (panics if token does not exist) |
| `is_metadata_frozen()` | `bool` |

---

## Auth Enforcement Test Coverage

| Entrypoint | Auth-rejection test |
|---|---|
| `initialize` | `test_initialize_already_initialized` (double-init) |
| `set_token_perk` | `test_set_token_perk_no_auth_fails` |
| `set_backend_minter` | `test_set_backend_minter_unauthorized` |
| `stock_shop` | `test_stock_shop_requires_admin_auth` |
| `backend_mint` / `mint_collectible` | `test_protected_mint_rejection`, `test_mint_collectible_unauthorized` |
| `migrate` | `test_migrate_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `init_shop` | `test_init_shop_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `set_fee_config` | `test_set_fee_config_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `restock_collectible` | `test_restock_collectible_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `update_collectible_prices` | `test_update_collectible_prices_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `set_collectible_for_sale` | `test_set_collectible_for_sale_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `set_pause` | `test_set_pause_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `set_base_uri` | `test_set_base_uri_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
| `set_token_metadata` | `test_set_token_metadata_rejects_without_auth` *(entrypoint_auth_tests.rs)* |
