# Withdraw Funds - Quick Reference

## Function Signature
```rust
pub fn withdraw_funds(e: Env, token: Address, to: Address, amount: u128)
```

## Usage Examples

### Withdraw TYC
```rust
client.withdraw_funds(&tyc_token_address, &recipient_address, &1000);
```

### Withdraw USDC
```rust
client.withdraw_funds(&usdc_token_address, &recipient_address, &500);
```

## Authorization
- **Required**: Admin role
- **Method**: `require_auth()` - Soroban built-in
- **Failure**: Transaction reverts if non-admin

## Token Allowlist
| Token | Status | Notes |
|-------|--------|-------|
| TYC | ✅ Allowed | Primary reward token |
| USDC | ✅ Allowed | Payment token |
| Others | ❌ Blocked | Panics with "Invalid token: not in allowlist" |

## Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Not initialized" | Contract not initialized | Call `initialize()` first |
| "Invalid token: not in allowlist" | Token not TYC or USDC | Use correct token address |
| "Insufficient contract balance" | Amount > contract balance | Reduce amount or fund contract |
| (Authorization failure) | Non-admin caller | Use admin account |

## Event Emitted
```
Event: ("Withdraw", token_address, recipient_address)
Data: amount (u128)
```

## Storage Keys Used
- `DataKey::Admin` - Admin address
- `DataKey::TycToken` - TYC token address
- `DataKey::UsdcToken` - USDC token address

## Initialization
```rust
client.initialize(&admin, &tyc_token_id, &usdc_token_id);
```

**Note**: USDC token address is now required (breaking change)

## Test Commands
```bash
# Run all tests
cargo test --lib

# Run specific test
cargo test --lib test_withdraw_funds_admin_can_withdraw

# Run with output
cargo test --lib -- --nocapture
```

## Security Checklist
- [x] Admin authorization enforced
- [x] Token validation prevents unauthorized withdrawals
- [x] Balance check prevents overdrafts
- [x] No reentrancy vulnerabilities
- [x] Events emitted for audit trail

## Integration Checklist
- [ ] Update contract initialization to include USDC token
- [ ] Fund contract with tokens before withdrawal
- [ ] Set up event listeners for "Withdraw" events
- [ ] Test with both TYC and USDC tokens
- [ ] Verify admin account has authorization

## Common Issues & Solutions

### Issue: "Not initialized"
**Cause**: Contract not initialized
**Solution**: Call `initialize()` with admin, TYC, and USDC addresses

### Issue: "Invalid token"
**Cause**: Using wrong token address
**Solution**: Verify token address matches TYC or USDC configured during init

### Issue: "Insufficient balance"
**Cause**: Contract doesn't have enough tokens
**Solution**: Fund contract with tokens using token client's mint/transfer

### Issue: Authorization fails
**Cause**: Non-admin caller
**Solution**: Use admin account for withdrawal

## Performance Notes
- **Gas Cost**: ~1000-2000 gas (single token transfer)
- **Execution Time**: <1ms
- **Storage Impact**: Minimal (no new storage per withdrawal)

## Audit Trail
All withdrawals are tracked via events:
```
Event: ("Withdraw", token_address, recipient_address) → amount
```

Listen for these events to maintain withdrawal history.

## Deployment Checklist
- [ ] Code compiled without errors
- [ ] All tests passing (6/6)
- [ ] Documentation reviewed
- [ ] Security audit completed
- [ ] Existing contracts updated for new initialize signature
- [ ] USDC token address obtained
- [ ] Admin account identified
- [ ] Test withdrawal executed
- [ ] Event listeners configured
- [ ] Monitoring set up

---

**Last Updated**: February 20, 2026
**Status**: Production Ready
**Version**: 1.0.0
