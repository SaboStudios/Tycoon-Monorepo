# TycoonToken (TYC)

A SEP-41 compliant fungible token on Stellar Soroban, ported from the ERC-20 TycoonToken Solidity contract.

## Overview

**Name:** Tycoon  
**Symbol:** TYC  
**Decimals:** 18  
**Initial Supply:** 1,000,000,000 TYC (1 billion tokens)  
**Standard:** SEP-41 Token Interface

## Features

- ✅ SEP-41 TokenInterface implementation (transfer, approve, allowance, burn, etc.)
- ✅ Admin-controlled minting with overflow protection
- ✅ Burnable tokens (self-burn and burn_from with allowance)
- ✅ Admin transfer capability
- ✅ One-time initialization
- ✅ Full event emissions (transfer, mint, burn, approve)

## Key Differences from Solidity/ERC-20

### Authorization
**Solidity:** Uses `onlyOwner` modifier and implicit `msg.sender`
```solidity
modifier onlyOwner() { require(msg.sender == owner); _; }
```

**Soroban:** Uses explicit `require_auth()` with cryptographic verification
```rust
admin.require_auth();  // Verifies signature
```

### Storage
**Solidity:** Inherits mappings from OpenZeppelin
```solidity
mapping(address => uint256) private _balances;
```

**Soroban:** Custom storage with DataKey enum
```rust
pub enum DataKey {
    Balance(Address),
    Allowance(Address, Address),
}
```

### Events
**Solidity:** `emit Transfer(from, to, amount);`  
**Soroban:** `env.events().publish((String::from_str(&e, "transfer"), from, to), amount);`

### Types
**Solidity:** `uint256` (unsigned)  
**Soroban:** `i128` (signed, SEP-41 standard)

## Functions

### Initialization
```rust
initialize(admin: Address, initial_supply: i128)
```
Initialize token and mint initial supply to admin. Can only be called once.

### Admin Functions
```rust
mint(to: Address, amount: i128)           // Mint tokens (admin only)
set_admin(new_admin: Address)             // Transfer admin rights (admin only)
admin() -> Address                        // Get current admin
total_supply() -> i128                    // Get total supply
```

### SEP-41 Token Operations
```rust
transfer(from: Address, to: Address, amount: i128)
transfer_from(spender: Address, from: Address, to: Address, amount: i128)
approve(from: Address, spender: Address, amount: i128, expiration_ledger: u32)
allowance(from: Address, spender: Address) -> i128
balance(id: Address) -> i128
burn(from: Address, amount: i128)
burn_from(spender: Address, from: Address, amount: i128)
```

### Metadata
```rust
name() -> String      // Returns "Tycoon"
symbol() -> String    // Returns "TYC"
decimals() -> u32     // Returns 18
```

## Building

```bash
cd contract/contracts/tycoon-token
cargo build --target wasm32-unknown-unknown --release
```

## Testing

```bash
cargo test
```

All 14 tests cover:
- Initialization and metadata
- Double initialization prevention
- Admin minting (positive, zero amounts)
- Token transfers (success and failure)
- Approve and transfer_from flow
- Allowance validation
- Burn operations (self and from allowance)
- Admin transfer and permissions

## Deployment

```bash
# Deploy
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/tycoon_token.wasm \
  --source <ADMIN_SECRET> \
  --network testnet

# Initialize with 1B tokens
stellar contract invoke \
  --id <CONTRACT_ID> \
  --source <ADMIN_SECRET> \
  --network testnet \
  -- initialize \
  --admin <ADMIN_ADDRESS> \
  --initial_supply 1000000000000000000000000000
```

## Usage Examples

### Mint Tokens
```bash
stellar contract invoke --id <CONTRACT_ID> -- mint \
  --to <USER_ADDRESS> \
  --amount 1000000000000000000000
```

### Transfer Tokens
```bash
stellar contract invoke --id <CONTRACT_ID> -- transfer \
  --from <FROM_ADDRESS> \
  --to <TO_ADDRESS> \
  --amount 1000000000000000000
```

### Approve and Transfer From
```bash
# Approve
stellar contract invoke --id <CONTRACT_ID> -- approve \
  --from <OWNER_ADDRESS> \
  --spender <SPENDER_ADDRESS> \
  --amount 1000000000000000000 \
  --expiration_ledger 0

# Transfer from
stellar contract invoke --id <CONTRACT_ID> -- transfer_from \
  --spender <SPENDER_ADDRESS> \
  --from <OWNER_ADDRESS> \
  --to <RECIPIENT_ADDRESS> \
  --amount 1000000000000000000
```

### Burn Tokens
```bash
stellar contract invoke --id <CONTRACT_ID> -- burn \
  --from <FROM_ADDRESS> \
  --amount 1000000000000000000
```

## Integration with TycoonRewardSystem

```rust
use tycoon_token::TycoonTokenClient;

pub fn reward_user(e: &Env, token_address: Address, user: Address, amount: i128) {
    let token = TycoonTokenClient::new(e, &token_address);
    token.mint(&user, &amount);
}
```

## Security Considerations

- Admin has unlimited minting power - secure admin key properly
- No maximum supply cap - admin can mint indefinitely
- Burning is irreversible and reduces total supply
- Authorization checks prevent unauthorized operations
- Overflow protection on all arithmetic operations

## Events

All operations emit events:
- **transfer**: `("transfer", from, to)` → `amount`
- **mint**: `("mint", to)` → `amount`
- **burn**: `("burn", from)` → `amount`
- **approve**: `("approve", from, spender)` → `(amount, expiration)`

## License

MIT
