# tycoon-game

Soroban smart contract that serves as the core game registry for the Tycoon board game on Stellar. Manages player registration, collectible metadata, cash tier configuration, treasury accounting, and privileged game-session control.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Public Interface](#public-interface)
  - [Lifecycle](#lifecycle)
  - [Admin-Only Entrypoints](#admin-only-entrypoints)
  - [Public Entrypoints](#public-entrypoints)
  - [Deprecated Shims](#deprecated-shims)
- [Treasury Model](#treasury-model)
- [Events](#events)
- [Storage Layout](#storage-layout)
- [Security Model](#security-model)
- [Building and Testing](#building-and-testing)
- [Usage Examples](#usage-examples)

---

## Overview

`tycoon-game` is the on-chain registry and control plane for the Tycoon game. It stores player profiles, collectible item metadata, cash tier values, and treasury state. A privileged `backend_game_controller` address (set by the owner) may remove players from active game sessions without requiring the owner key for every operation.

Key design decisions:

- **Single `require_admin` helper** — all admin-gated functions funnel through one internal helper, making the auth boundary easy to audit.
- **CEI pattern** — in `admin_withdraw_funds`, balance checks and state reads happen before the external token transfer.
- **No oracle or unaudited privileged pattern** — prices are set directly by the admin; the only off-chain privileged role is `backend_game_controller`, which is admin-controlled and rotatable.
- **Deprecation shims** — old entrypoint names are preserved as thin `#[deprecated]` wrappers so existing integrations continue to compile through the v0.2 → v1.0 transition.

---

## Architecture

```
src/
├── lib.rs          # Contract entry points (TycoonContract)
├── storage.rs      # DataKey enum, structs, and all storage helpers
├── events.rs       # Event emission helpers
├── treasury.rs     # TreasurySnapshot struct and invariant helpers
├── test.rs         # Unit and integration tests
├── simulation_scenarios.rs  # Realistic game-session scenario tests (SIM-01 – SIM-20)
├── game_coverage_tests.rs   # Additional coverage tests
├── admin_access_control_tests.rs  # Auth-rejection tests (ACT-01 – ACT-13)
└── deprecated_entrypoints_tests.rs  # Backward-compat shim tests
```

---

## Public Interface

### Lifecycle

#### `initialize(env, tyc_token, usdc_token, initial_owner, reward_system)`

Initializes the contract. Must be called exactly once. The `initial_owner` must authorize this call.

- Stores `tyc_token`, `usdc_token`, `initial_owner`, and `reward_system`.
- Sets `state_version` to `1`.
- Panics with `"Contract already initialized"` if called more than once.

#### `admin_migrate(env)` *(admin only)*

Migrates the contract to a newer state version. Safe to call multiple times; already-current versions are no-ops.

- Version 0 → 1: sets `state_version` to `1`.
- Version 1: placeholder for future migration.

---

### Admin-Only Entrypoints

All functions in this section call `require_admin` internally. The stored `owner` address must authorize every call.

#### `admin_withdraw_funds(env, token, to, amount)`

Withdraws TYC or USDC tokens from the contract treasury.

| Parameter | Type | Description |
|---|---|---|
| `token` | `Address` | Must be the stored TYC or USDC address |
| `to` | `Address` | Recipient of the withdrawn tokens |
| `amount` | `u128` | Amount to withdraw (must not exceed contract balance) |

Errors:
- `"Invalid token address"` — `token` is not TYC or USDC.
- `"Insufficient contract balance"` — contract holds less than `amount`.

Emits: `FundsWithdrawn`.

#### `admin_set_collectible_info(env, token_id, perk, strength, tyc_price, usdc_price, shop_stock)`

Creates or overwrites on-chain metadata for a collectible NFT.

| Parameter | Type | Description |
|---|---|---|
| `token_id` | `u128` | Unique collectible identifier |
| `perk` | `u32` | Perk type code |
| `strength` | `u32` | Perk strength value |
| `tyc_price` | `u128` | Price in TYC tokens |
| `usdc_price` | `u128` | Price in USDC |
| `shop_stock` | `u64` | Available shop inventory |

#### `admin_set_cash_tier_value(env, tier, value)`

Sets the token value for a cash tier.

#### `admin_set_game_controller(env, new_controller)`

Updates the backend game controller address. The backend controller is a privileged off-chain service that may call `remove_player_from_game` without being the owner.

#### `admin_mint_registration_voucher(env, player)`

Mints a 2-TYC registration voucher for a player via the reward system contract.

---

### Public Entrypoints

These functions are callable by any address (subject to their own auth requirements).

#### `register_player(env, username, caller)`

Registers a new player. The `caller` must authorize this call.

| Validation | Error |
|---|---|
| Already registered | `"Address already registered"` |
| Username length < 3 or > 20 | `"Username must be 3-20 characters"` |

Stores a `User` struct with `id`, `username`, `address`, `registered_at`, `games_played`, and `games_won`.

#### `remove_player_from_game(env, caller, game_id, player, turn_count)`

Removes a player from an active game session. Authorized callers: the stored `owner` **or** the `backend_game_controller`. The `caller` must authorize this call.

- Panics with `"Unauthorized: caller must be owner or backend game controller"` if `caller` is neither.
- Emits: `PlayerRemovedFromGame`.

#### `get_user(env, address) → Option<User>`

Returns the stored profile for `address`, or `None` if not registered.

#### `get_collectible_info(env, token_id) → (perk, strength, tyc_price, usdc_price, shop_stock)`

Returns the metadata tuple for a collectible. Panics with `"Collectible does not exist"` if `token_id` is unknown.

#### `get_cash_tier_value(env, tier) → u128`

Returns the token value for a cash tier. Panics with `"Cash tier does not exist"` if `tier` is unknown.

#### `export_state(env) → ContractStateDump`

Exports a read-only snapshot of critical contract state for debugging and support. No auth required.

Returns:

| Field | Type | Description |
|---|---|---|
| `owner` | `Address` | Current owner address |
| `tyc_token` | `Address` | TYC token contract address |
| `usdc_token` | `Address` | USDC token contract address |
| `reward_system` | `Address` | Reward system contract address |
| `state_version` | `u32` | Current state schema version |
| `is_initialized` | `bool` | Whether `initialize` has been called |
| `backend_controller` | `Option<Address>` | Backend game controller, if set |

---

### Deprecated Shims

The following thin wrappers preserve old entrypoint names for backward compatibility. They delegate directly to the `admin_*` variants and will be removed in v1.0.0. New integrations must use the `admin_*` names.

| Deprecated | Replacement |
|---|---|
| `migrate` | `admin_migrate` |
| `withdraw_funds` | `admin_withdraw_funds` |
| `set_collectible_info` | `admin_set_collectible_info` |
| `set_cash_tier_value` | `admin_set_cash_tier_value` |
| `set_backend_game_controller` | `admin_set_game_controller` |
| `mint_registration_voucher` | `admin_mint_registration_voucher` |

---

## Treasury Model

`TreasurySnapshot` is an off-chain accounting helper (not stored on-chain) used in tests and tooling to verify the balance-sheet invariant:

```
sum_of_balances + escrow == liabilities + treasury
```

| Field | Description |
|---|---|
| `sum_of_balances` | Sum of all player balances |
| `escrow` | Funds locked in active game escrow |
| `liabilities` | Outstanding obligations to players |
| `treasury` | Unencumbered contract-owned funds |

`invariant_holds()` returns `false` on overflow rather than panicking. `assert_invariant()` panics with a descriptive message if the invariant is violated.

---

## Events

| Event | Topics | Data | Emitted by |
|---|---|---|---|
| `FundsWithdrawn` | `(FundsWithdrawn, token, to)` | `amount: u128` | `admin_withdraw_funds` |
| `PlayerRemovedFromGame` | `(PlayerRemovedFromGame, game_id, player)` | `turn_count: u32` | `remove_player_from_game` |

---

## Storage Layout

| Key | Storage tier | Type | Description |
|---|---|---|---|
| `Owner` | Instance | `Address` | Contract owner |
| `TycToken` | Instance | `Address` | TYC token address |
| `UsdcToken` | Instance | `Address` | USDC token address |
| `IsInitialized` | Instance | `bool` | Initialization guard |
| `RewardSystem` | Instance | `Address` | Reward system contract |
| `BackendGameController` | Instance | `Option<Address>` | Privileged off-chain controller |
| `StateVersion` | Instance | `u32` | State schema version |
| `Collectible(token_id)` | Persistent | `CollectibleInfo` | Per-collectible metadata |
| `CashTier(tier)` | Persistent | `u128` | Per-tier token value |
| `User(address)` | Persistent | `User` | Per-player profile |
| `Registered(address)` | Persistent | `bool` | Registration flag |

Instance storage is appropriate for contract-lifetime configuration. Persistent storage is used for long-lived game data (collectibles, cash tiers, player profiles).

---

## Security Model

- **`require_admin`** is the single internal helper for owner authorization — all admin-gated functions call it, making the auth boundary easy to audit.
- **CEI pattern** in `admin_withdraw_funds`: token address and balance checks happen before the external `token.transfer` call.
- **No unaudited oracle** — collectible prices and cash tier values are set directly by the admin.
- **`backend_game_controller`** is the only privileged off-chain role. It is set and rotatable by the owner via `admin_set_game_controller`. Absence of a controller is handled safely (`Option<Address>`).
- **`initialize` is one-time** — guarded by `DataKey::IsInitialized`; a second call panics immediately.
- **No owner rotation** — the owner key cannot be changed post-deploy (open item OI-2 in `SECURITY_REVIEW_CHECKLIST.md`).
- **`overflow-checks = true`** and **`panic = "abort"`** in the release profile (workspace `Cargo.toml`).
- **`#[no_std]`** — no standard library; minimal attack surface.

See `SECURITY_REVIEW_CHECKLIST.md` for the full security review and open items.

---

## Building and Testing

```bash
# Check the workspace (must pass for CI)
cargo check --package tycoon-game

# Run all unit and integration tests
cargo test --package tycoon-game

# Build optimized WASM
stellar contract build
```

The optimized WASM is written to:
```
target/wasm32v1-none/release/tycoon_game.wasm
```

Or using the Makefile:
```bash
make          # build
make test     # build + test
make fmt      # format
make clean    # clean
```

---

## Usage Examples

```rust
// 1. Initialize the contract
client.initialize(&tyc_token, &usdc_token, &owner, &reward_system);

// 2. Configure collectibles
client.admin_set_collectible_info(&1, &5, &100, &1_000, &500, &50);

// 3. Configure cash tiers
client.admin_set_cash_tier_value(&1, &100);
client.admin_set_cash_tier_value(&2, &500);
client.admin_set_cash_tier_value(&3, &1_000);

// 4. Set a backend game controller
client.admin_set_game_controller(&backend_service);

// 5. Register a player
client.register_player(&String::from_str(&env, "alice"), &alice);

// 6. Backend removes a player from a game
client.remove_player_from_game(&backend_service, &game_id, &alice, &turn_count);

// 7. Admin withdraws treasury funds
client.admin_withdraw_funds(&tyc_token, &treasury_wallet, &amount);

// 8. Export contract state for debugging
let dump = client.export_state();
```
