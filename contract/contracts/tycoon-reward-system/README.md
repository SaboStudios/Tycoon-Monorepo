# Tycoon Reward System

Soroban smart contract for the Tycoon reward system, handling voucher minting, redemption, and collectible perks.

## Voucher ID Starting Value

Minted voucher ids start at `1_000_000_000` (the `VOUCHER_ID_START` constant in `src/lib.rs`) and increase by one for each new voucher. This offset exists because collectible ids and voucher ids both use `u128`, so a marketplace must not treat small collectible ids and voucher ids as the same namespace — the high starting value keeps the two id ranges clearly separated. Collectible ids are issued by a different contract, not by this reward system.

## Features

- **Voucher Minting**: Admin or backend minter can mint vouchers with TYC value
- **Voucher Redemption**: Users can redeem vouchers for TYC tokens
- **Collectible Perks**: Collectibles can have perks (strength, TYC value, USDC value)
- **Pausable**: Admin can pause/unpause the contract in emergencies
- **Backend Minter**: Optional backend address authorized to mint vouchers
- **State Migration**: Versioned state for safe upgrades

## Contract Structure

- `initialize`: Set up admin, TYC token, USDC token
- `mint_voucher`: Mint a new voucher (admin or backend minter only)
- `redeem_voucher_from`: Redeem a voucher for TYC tokens
- `pause`/`unpause`: Emergency controls (admin only)
- `set_backend_minter`/`clear_backend_minter`: Manage backend minter (admin only)
- `withdraw_funds`: Withdraw tokens from contract (admin only)
- `migrate`: Upgrade state version (admin only)

## Building

```bash
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
cargo test
```
