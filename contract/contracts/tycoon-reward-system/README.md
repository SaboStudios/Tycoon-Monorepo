# Tycoon Reward System

Soroban smart contract that manages reward vouchers, backend minter authorization, and fee handling for the Tycoon game.

## Overview

The reward system contract allows an admin to authorize a backend minter that can issue vouchers to players. Vouchers are redeemed for rewards and tracked on-chain.

## Admin Functions

### `set_backend_minter(env, minter)`

Sets the backend minter address. Only the stored admin can call this function; the admin address is read from storage and must authorize the call. The caller does not need to pass their own address.

- **Arguments:**
  - `minter`: The address to authorize as the backend minter.
- **Authorization:** Requires the stored admin's signature. A non-admin caller will fail.
- **Behavior:** The stored minter is updated only after the authorization check succeeds.

### `clear_backend_minter(env)`

Clears the backend minter. Only the stored admin can call this function; the admin address is read from storage and must authorize the call. No arguments are required.

- **Authorization:** Requires the stored admin's signature. A non-admin caller will fail.
- **Behavior:** The stored minter is cleared only after the authorization check succeeds.

### `get_backend_minter(env)`

Returns the currently configured backend minter address, if any.

## Minter Functions

### `mint_voucher(env, ...)`

Issues a voucher. Requires the stored backend minter's authorization. The minter address is read from storage rather than passed as an argument.

## Example

```rust
// Admin sets the backend minter (no admin address argument needed)
contract.set_backend_minter(&minter_address);

// Admin clears the backend minter (no arguments)
contract.clear_backend_minter();

// Read the current minter
let minter = contract.get_backend_minter();
```
