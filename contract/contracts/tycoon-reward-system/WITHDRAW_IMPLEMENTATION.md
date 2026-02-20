# Withdraw Funds Implementation

## Overview
The `withdraw_funds` function enables the admin to withdraw TYC or USDC tokens from the reward system contract. This is essential for contract maintenance, fund recovery, and treasury management.

## Implementation Details

### Function Signature
```rust
pub fn withdraw_funds(e: Env, token: Address, to: Address, amount: u128)
```

### Parameters
- `e: Env` - Soroban environment
- `token: Address` - Token address to withdraw (must be TYC or USDC)
- `to: Address` - Recipient address
- `amount: u128` - Amount to withdraw (in token's smallest unit)

### Authorization
- **Admin Only**: Requires admin authorization via `require_auth()`
- Uses Soroban's built-in authorization mechanism

### Token Allowlist
The contract maintains a whitelist of allowed tokens:
- **TYC Token**: Primary reward token (configured during initialization)
- **USDC Token**: Payment token (configured during initialization)

Any attempt to withdraw other tokens will panic with "Invalid token: not in allowlist"

### Validation Checks (in order)
1. **Admin Authorization**: Caller must be the admin
2. **Token Validation**: Token must be TYC or USDC
3. **Balance Check**: Contract must have sufficient balance
4. **Transfer Execution**: Token transfer from contract to recipient

### Error Handling
All errors result in contract panic (Soroban standard):

| Error | Condition | Message |
|-------|-----------|---------|
| Unauthorized | Non-admin caller | (implicit from `require_auth()`) |
| Invalid Token | Token not in allowlist | "Invalid token: not in allowlist" |
| Insufficient Balance | Contract balance < amount | "Insufficient contract balance" |

### Event Emission
Emits a `Withdraw` event with:
- **Topics**: `("Withdraw", token_address, recipient_address)`
- **Data**: `amount` (u128)

Event format:
```rust
#[allow(deprecated)]
e.events()
    .publish((symbol_short!("Withdraw"), token.clone(), to), amount);
```

## Storage Changes

### New DataKey Variant
Added `UsdcToken` to the `DataKey` enum to store the USDC token address:
```rust
pub enum DataKey {
    // ... existing variants ...
    UsdcToken,  // NEW: Stores USDC token address
}
```

### Updated Initialization
The `initialize` function now accepts both TYC and USDC token addresses:
```rust
pub fn initialize(e: Env, admin: Address, tyc_token: Address, usdc_token: Address)
```

## Security Considerations

### Reentrancy Protection
- **Implicit Protection**: Soroban's execution model prevents recursive calls within the same transaction
- **CEI Pattern**: Checks (balance validation) → Effects (none) → Interactions (token transfer)
- **No State Flags**: Not needed due to Soroban's deterministic execution

### Balance Validation
- Contract balance is checked before transfer
- Prevents overdraft scenarios
- Uses token client's balance query for accuracy

### Token Validation
- Strict equality check against stored token addresses
- No dynamic allowlist modifications
- Prevents unauthorized token withdrawals

## Testing

### Test Coverage
All acceptance criteria are covered:

1. **test_withdraw_funds_admin_can_withdraw**
   - Admin successfully withdraws TYC
   - Admin successfully withdraws USDC
   - Balances updated correctly
   - Multiple withdrawals supported

2. **test_withdraw_funds_non_admin_reverts**
   - Non-admin caller fails authorization
   - Transaction reverts

3. **test_withdraw_funds_insufficient_balance_reverts**
   - Withdrawal exceeding contract balance fails
   - Transaction reverts

4. **test_withdraw_funds_invalid_token_reverts**
   - Withdrawal of non-whitelisted token fails
   - Transaction reverts

### Running Tests
```bash
cargo test --lib
```

All 6 tests pass:
- ✅ test_simple_event
- ✅ test_withdraw_funds_admin_can_withdraw
- ✅ test_withdraw_funds_non_admin_reverts
- ✅ test_withdraw_funds_insufficient_balance_reverts
- ✅ test_withdraw_funds_invalid_token_reverts
- ✅ test_voucher_flow

## Integration Notes

### Calling the Function
```rust
// Admin withdraws 1000 TYC to recipient
client.withdraw_funds(&tyc_token_address, &recipient_address, &1000);

// Admin withdraws 500 USDC to recipient
client.withdraw_funds(&usdc_token_address, &recipient_address, &500);
```

### Event Listening
Applications can listen for `Withdraw` events to track fund movements:
```
Event: ("Withdraw", token_address, recipient_address) → amount
```

### Contract Funding
Before withdrawal, the contract must be funded with tokens:
```rust
// Fund contract with TYC
token::StellarAssetClient::new(&env, &tyc_token_id)
    .mint(&contract_address, &amount);
```

## Acceptance Criteria Met

✅ **Admin can withdraw token balance**
- Verified in `test_withdraw_funds_admin_can_withdraw`
- Both TYC and USDC withdrawals tested

✅ **Unauthorized reverts**
- Verified in `test_withdraw_funds_non_admin_reverts`
- Non-admin caller fails

✅ **Tests pass**
- All 6 tests pass
- Comprehensive coverage of success and failure paths

✅ **Reentrancy consideration**
- Implicit protection via Soroban execution model
- CEI pattern followed

✅ **Token allowlist documented**
- Stored in DataKey enum
- Validated in withdraw_funds function
- Only TYC and USDC allowed

## Future Enhancements

1. **Multi-token Support**: Extend allowlist dynamically
2. **Withdrawal Limits**: Add per-token withdrawal caps
3. **Timelock**: Add delay before withdrawal execution
4. **Multi-sig**: Require multiple admin signatures
5. **Withdrawal History**: Track all withdrawals in storage
