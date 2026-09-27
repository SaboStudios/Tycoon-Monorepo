# Tycoon Collectibles Contract

A Soroban smart contract implementing safe transfer logic and multi-token management for the Tycoon game.

## Overview

This contract provides the core transfer primitives that power buying, minting to users, and batch operations — including balance updates, enumeration, and event emission.

## Features

### Core Transfer Logic
- **`_safe_transfer`**: Internal helper for safe token transfers between addresses
- **`_safe_mint`**: Mint new tokens to users
- **`_safe_burn`**: Burn tokens from users
- **`_safe_batch_transfer`**: Stub for future batch operations

### Public Functions
- **`initialize(admin: Address)`**: Initialize the contract with an admin
- **`buy_collectible(buyer, token_id, amount)`**: Mint tokens to buyer
- **`transfer(from, to, token_id, amount)`**: Transfer tokens between addresses
- **`burn(owner, token_id, amount)`**: Burn tokens from owner
- **`balance_of(owner, token_id)`**: Get balance of a specific token
- **`tokens_of(owner)`**: Get all token IDs owned by an address

## Architecture

The contract is organized into modular components:

```
src/
├── lib.rs          # Main contract interface
├── storage.rs      # Persistent storage management
├── types.rs        # Data structures
├── enumeration.rs  # Token ownership tracking
├── transfer.rs     # Core transfer logic
├── events.rs       # Event emission
└── test.rs         # Comprehensive test suite
```

## Key Features

### Balance Management
- Tracks individual token balances per address
- Supports amounts > 1 for fungible-like collectibles
- Automatically cleans up zero balances

### Enumeration
- Maintains a list of owned token IDs per address
- Automatically updates on mint/transfer/burn
- Efficient lookup of all tokens owned by an address

### Event Emission
- **Transfer Event**: Emitted on every transfer with `(from, to, token_id, amount)`
- **Mint Event**: Emitted on minting with `(to, token_id, amount)`
- **Burn Event**: Emitted on burning with `(from, token_id, amount)`

### Safety Features
- Panics on insufficient balance
- Panics on unauthorized callers (via `require_auth`)
- Validates non-zero amounts
- Atomic balance updates

## Testing

The contract includes comprehensive tests covering:
- ✅ Initialization
- ✅ Minting (buy_collectible)
- ✅ Transfers between addresses
- ✅ Insufficient balance protection
- ✅ Burn functionality
- ✅ Enumeration updates
- ✅ Complete mint → transfer → burn flows

Run tests with:
```bash
cargo test --package tycoon-collectibles
```

## Build

```bash
cargo build --release --target wasm32-unknown-unknown
```

The optimized WASM will be in `target/wasm32-unknown-unknown/release/tycoon_collectibles.wasm`

## Usage Example

```rust
// Initialize contract
client.initialize(&admin);

// Buy a collectible (mints to buyer)
client.buy_collectible(&alice, &1, &10);

// Transfer tokens
client.transfer(&alice, &bob, &1, &5);

// Check balance
let balance = client.balance_of(&alice, &1); // Returns 5

// Get all owned tokens
let tokens = client.tokens_of(&alice); // Returns [1]

// Burn tokens
client.burn(&alice, &1, &5);
```

## Future Enhancements

- Full implementation of `_safe_batch_transfer` for gas-efficient multi-token operations
- Metadata management for collectibles
- Approval/operator patterns for delegated transfers
- Royalty support for secondary sales

## License

MIT
