# Tycoon Reward System

The Tycoon Reward System is a Soroban smart contract that manages in-game reward vouchers and collectibles for the Tycoon ecosystem. It allows the backend to mint vouchers for players, players to redeem them for TYC tokens, and admins to manage collectibles and withdraw funds.

## Overview

The contract provides the following core functionality:

- **Voucher Minting**: Backend minters can mint vouchers with a specified TYC value
- **Voucher Redemption**: Players can redeem vouchers for TYC tokens
- **Voucher Burning**: Vouchers can be burned
- **Collectible Management**: Admins can create and manage collectible items
- **Fund Withdrawal**: Admins can withdraw accumulated TYC and USDC tokens
- **Pause/Unpause**: Admins can pause the contract in emergencies

## Authorization

The table below documents the signer each public method requires **today**, as enforced by the current `require_auth` calls in `src/lib.rs`. It reflects the code as written, not a desired end state.

| Method | Required signer | Notes |
| --- | --- | --- |
| `initialize` | **Open** (no `require_auth`) | Anyone may call it once; guarded only by the `Already initialized` check. |
| `migrate` | Admin | Reads stored `Admin` and calls `admin.require_auth()`. |
| `pause` | Admin | `admin.require_auth()`. |
| `unpause` | Admin | `admin.require_auth()`. |
| `set_backend_minter` | Admin | Caller must equal stored admin, then `admin.require_auth()`. |
| `clear_backend_minter` | Admin | Caller must equal stored admin, then `admin.require_auth()`. |
| `get_backend_minter` | **Open** (no `require_auth`) | Read-only view. |
| `mint_voucher` | Admin **or** backend minter | `caller.require_auth()` plus an explicit check that `caller` is the admin or the configured backend minter. |
| `redeem_voucher` | **Open** (no `require_auth`) | Always panics with `Use redeem_voucher_from instead`. |
| `redeem_voucher_from` | Redeemer | `redeemer.require_auth()`. |
| `burn_voucher` | Admin **or** backend minter | `caller.require_auth()` plus an explicit check that `caller` is the admin or the configured backend minter. |
| `withdraw_funds` | **Admin only** | `admin.require_auth()` on the stored admin. |

## Getting Started

### Prerequisites

- Rust and Cargo
- Soroban CLI
- Stellar account with testnet funds

### Building

```bash
cd contract/contracts/tycoon-reward-system
cargo build --target wasm32-unknown-unknown --release
```

### Testing

```bash
cargo test -p tycoon-reward-system
```

### Deployment

1. Build the contract:
```bash
soroban contract build
```

2. Deploy to testnet:
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/tycoon_reward_system.wasm \
  --source <your-secret-key> \
  --network testnet
```

3. Initialize the contract:
```bash
soroban contract invoke \
  --id <contract-id> \
  --source <your-secret-key> \
  --network testnet \
  -- initialize \
  --admin <admin-address> \
  --tyc_token <tyc-token-address> \
  --usdc_token <usdc-token-address>
```

## Usage

### Minting Vouchers

Only the admin or the configured backend minter can mint vouchers:

```bash
soroban contract invoke \
  --id <contract-id> \
  --source <backend-minter-secret-key> \
  --network testnet \
  -- mint_voucher \
  --caller <backend-minter-address> \
  --to <player-address> \
  --tyc_value 1000
```

### Redeeming Vouchers

Players can redeem their vouchers for TYC tokens:

```bash
soroban contract invoke \
  --id <contract-id> \
  --source <player-secret-key> \
  --network testnet \
  -- redeem_voucher_from \
  --redeemer <player-address> \
  --token_id 1000000001
```

### Burning Vouchers

Only the admin or the configured backend minter can burn vouchers:

```bash
soroban contract invoke \
  --id <contract-id> \
  --source <backend-minter-secret-key> \
  --network testnet \
  -- burn_voucher \
  --caller <backend-minter-address> \
  --token_id 1000000001
```

### Withdrawing Funds

Only the admin can withdraw funds:

```bash
soroban contract invoke \
  --id <contract-id> \
  --source <admin-secret-key> \
  --network testnet \
  -- withdraw_funds \
  --token <token-address> \
  --to <recipient-address> \
  --amount 1000
```

## Contract Structure

- `src/lib.rs`: Main contract implementation
- `src/test.rs`: Test suite

## Production builds

Production builds must not export test entrypoints. The contract ABI intentionally
exposes only the real entrypoints (`mint_voucher`, `redeem_voucher_from`, `burn_voucher`,
and the admin/backend configuration functions). Helper functions such as `_mint` and
`_burn` are crate-private and are exercised only from unit tests inside the crate.

Do not add `test_mint`, `test_burn`, or any other unauthenticated test-only entrypoint
to a `#[contractimpl]` block. If a test needs to mint or burn directly, call the
private helpers from a `#[cfg(test)]` module instead of exposing a public entrypoint.

## Security Considerations

- Vouchers can only be minted by the admin or the configured backend minter
- Only the admin can withdraw funds
- The contract can be paused in emergencies
- Voucher values are stored on-chain and verified during redemption

## License

This contract is part of the Tycoon project and follows the project's licensing terms.
