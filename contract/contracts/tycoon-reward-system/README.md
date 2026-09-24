# Tycoon Reward System Contract

This project implements the `TycoonRewardSystem` smart contract on the Soroban platform. It serves as the foundational multi-token system for managing balances, vouchers, and collectibles.

## Features

- **Multi-Token Storage**: Efficient persistent storage for user balances using `Map<(Address, u128), u64>`.
- **Token Handling**:
  - `VOUCHER_ID_START` (1,000,000,000) for distinct voucher handling.
  - `COLLECTIBLE_ID_START` (2,000,000,000) for collectible items.
- **Core Operations**:
  - `_mint`: Internal helper to mint tokens to an address.
  - `_burn`: Internal helper to burn tokens from an address.
  - `balance_of`: Query token balance for a specific owner.
- **Events**: Emits standard Soroban events for Mint and Burn actions.
- **Safety**: Includes overflow protection and sufficiency checks for burning.

## Project Structure

- `src/lib.rs`: Main contract logic, storage definitions, and helper functions.
- `src/test.rs`: Unit tests verifying mint, burn, overflow protection, and event emission.

## usage

### Prerequisites

Ensure you have the Rust toolchain and Soroban CLI installed.

### Building

To build the contract as a WASM file:

```bash
cargo build --target wasm32-unknown-unknown --release
```

### Testing

Run the unit tests included in the project:

```bash
cargo test
```

> **Note**: You cannot run `cargo run` because this project is a library crate designed for WASM compilation, not a standalone binary.

## Development

- **Formatting**: `cargo fmt`
- **Linting**: `cargo clippy`

## Emergency Pause/Unpause

The contract includes an emergency pause mechanism for use in case of vulnerabilities or exploits. Only the admin can invoke these functions:

- `pause(env)`: Pauses the contract. While paused, `redeem_voucher_from` is disabled and will revert if called.
- `unpause(env)`: Resumes normal contract operation.

Events are emitted for both Paused and Unpaused actions. This mechanism is intended for emergency use only to prevent further voucher redemptions if an issue is detected.

**Usage Example:**

```rust
// Admin pauses the contract
tycoon_reward_system.pause(env);

// Attempting to redeem while paused will fail
// tycoon_reward_system.redeem_voucher_from(env, user, token_id); // panics

// Admin unpauses the contract
tycoon_reward_system.unpause(env);
```

- Only the admin can pause or unpause. Unauthorized attempts will revert.
- When paused, all voucher redemptions are blocked.
- Use this feature only in emergencies.

## License

[License Information Here]
