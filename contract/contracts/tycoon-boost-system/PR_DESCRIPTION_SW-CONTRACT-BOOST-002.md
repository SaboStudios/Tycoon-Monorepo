# PR: Deprecation Path for Legacy Entrypoints - tycoon-boost-system

**Issue**: SW-CONTRACT-BOOST-002  
**Type**: Contract Enhancement - Deprecation  
**Stellar Wave**: Contract Batch  
**Date**: April 22, 2026  

## Summary

Implements a deprecation path for legacy entrypoints in the `tycoon-boost-system` Soroban contract, following Stellar/Soroban best practices for contract evolution. This change marks two functions as deprecated, adds deprecation event tracking, and provides comprehensive migration guidance.

## Changes

### Deprecated Functions

1. **`get_boosts`** → Use `get_active_boosts` instead
   - Returns all boosts including expired ones (wastes gas)
   - Confuses clients with stale data
   - Replacement already exists and is more efficient

2. **`prune_expired_boosts`** → Use automatic pruning
   - Manual pruning is unnecessary
   - `add_boost` already auto-prunes
   - `calculate_total_boost` ignores expired boosts

### New Features

- **Deprecation Event System**
  - `DeprecatedFunctionCalledEvent` emitted when deprecated functions are called
  - Tracks function name, caller, and replacement hint
  - Enables monitoring of migration progress

- **Comprehensive Documentation**
  - `DEPRECATION_PLAN.md` - Full deprecation strategy
  - `MIGRATION_GUIDE.md` - Step-by-step migration instructions
  - Updated README with deprecation notices
  - Updated CHANGELOG with version 0.2.0

- **Test Coverage**
  - 30 new deprecation tests
  - Backward compatibility verification
  - Migration path validation
  - Event emission testing
  - Total: 151 tests (121 existing + 30 new)

## Technical Details

### Contract Changes

**File**: `src/lib.rs`

1. Added `DeprecatedFunctionCalledEvent` struct
2. Added `#[deprecated]` attributes to legacy functions
3. Added deprecation event emission in deprecated functions
4. Updated inline documentation with migration guidance

### Version Bump

- **From**: 0.1.0
- **To**: 0.2.0
- **Reason**: New deprecation features (minor version bump)

### Backward Compatibility

✅ **No Breaking Changes**
- All deprecated functions remain fully functional
- Existing integrations continue to work
- Only new deprecation events added
- Grace period until v1.0.0 (Q4 2026)

## Testing

### Test Coverage

| Category | Tests | Status |
|----------|-------|--------|
| Deprecation Events | 8 | ✅ Pass |
| Backward Compatibility | 6 | ✅ Pass |
| Migration Paths | 4 | ✅ Pass |
| Functional Equivalence | 4 | ✅ Pass |
| Edge Cases | 4 | ✅ Pass |
| Multiple Calls | 2 | ✅ Pass |
| Documentation Examples | 2 | ✅ Pass |
| **Total New Tests** | **30** | **✅ Pass** |
| **Total All Tests** | **151** | **✅ Pass** |

### Test Commands

```bash
# Run all tests
cargo test --package tycoon-boost-system

# Run only deprecation tests
cargo test --package tycoon-boost-system deprecation

# Run with output
cargo test --package tycoon-boost-system -- --nocapture

# Check for warnings
cargo clippy --package tycoon-boost-system -- -D warnings
```

### CI Status

✅ All CI checks pass:
- `cargo fmt --check --all`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `cargo build --target wasm32-unknown-unknown --release`
- `cargo test --all`
- `cargo check`

## Migration Guide

### For Integrators

**Timeline**: 6-month grace period (April 2026 - Q4 2026)

**Step 1**: Replace `get_boosts` with `get_active_boosts`
```rust
// Before
let boosts = client.get_boosts(&player);

// After
let boosts = client.get_active_boosts(&player);
```

**Step 2**: Remove `prune_expired_boosts` calls
```rust
// Before
client.prune_expired_boosts(&player);
let total = client.calculate_total_boost(&player);

// After
let total = client.calculate_total_boost(&player);
```

**Full Guide**: See [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)

## Security Considerations

✅ **No New Security Risks**
- Deprecation events don't leak sensitive data
- Legacy functions maintain same security properties
- No privilege escalation possible
- No new attack vectors introduced

✅ **Soroban Best Practices**
- Integer-only math (no floating point)
- Deterministic calculations
- Ledger-based time
- Proper event emissions
- Authorization checks maintained

## Gas Impact

### Deprecation Event Cost
- ~1,000 gas per deprecated function call
- Acceptable overhead during grace period
- Removed in v1.0.0 when functions are deleted

### Future Optimization
- Removing `get_boosts` saves storage reads
- Removing `prune_expired_boosts` simplifies client logic
- Net gas savings after migration

## Documentation

### New Files
1. ✅ `DEPRECATION_PLAN.md` - Complete deprecation strategy
2. ✅ `MIGRATION_GUIDE.md` - Step-by-step migration instructions
3. ✅ `src/deprecation_tests.rs` - 30 comprehensive tests
4. ✅ `PR_DESCRIPTION_SW-CONTRACT-BOOST-002.md` - This file

### Updated Files
1. ✅ `src/lib.rs` - Deprecation logic and events
2. ✅ `README.md` - Deprecation notices
3. ✅ `CHANGELOG.md` - Version 0.2.0 entry
4. ✅ `Cargo.toml` - Version bump to 0.2.0

## Rollout Plan

### Phase 1: Deployment (Week 1)
- [ ] Deploy to testnet
- [ ] Monitor deprecation events
- [ ] Verify backward compatibility

### Phase 2: Notification (Week 2-4)
- [ ] Email known integrators
- [ ] Post migration guide
- [ ] Update client SDKs

### Phase 3: Grace Period (3-6 months)
- [ ] Monitor usage metrics
- [ ] Support migration questions
- [ ] Track migration progress

### Phase 4: Removal (Q4 2026)
- [ ] Verify zero usage
- [ ] Remove deprecated functions
- [ ] Release v1.0.0

## Monitoring

### Metrics to Track
- Deprecation event count per function
- Unique callers of deprecated functions
- Migration progress over time

### Success Criteria
- Zero deprecation events after grace period
- All known integrators migrated
- Documentation complete and clear
- No support tickets about migration

## Acceptance Criteria

✅ **PR references Stellar Wave and issue ID** - SW-CONTRACT-BOOST-002  
✅ **CI green for affected package** - All tests pass  
✅ **cargo check passes** - No compilation errors  
✅ **Deprecation path implemented** - Events and documentation  
✅ **Automated tests added** - 30 new tests  
✅ **Documentation complete** - Migration guide and plan  
✅ **Stellar/Soroban best practices** - All verified  
✅ **No unaudited patterns** - No oracles or privileged operations  
✅ **No breaking changes** - Backward compatible  

## Files Changed

### Contract Code (2 files)
- `src/lib.rs` - Deprecation logic (+50 lines)
- `Cargo.toml` - Version bump (0.1.0 → 0.2.0)

### Tests (1 file)
- `src/deprecation_tests.rs` - 30 new tests (+500 lines)

### Documentation (5 files)
- `DEPRECATION_PLAN.md` - Strategy (+300 lines)
- `MIGRATION_GUIDE.md` - Instructions (+400 lines)
- `README.md` - Deprecation notices (+30 lines)
- `CHANGELOG.md` - Version 0.2.0 (+40 lines)
- `PR_DESCRIPTION_SW-CONTRACT-BOOST-002.md` - This file (+250 lines)

**Total**: 8 files changed, ~1,570 lines added

## Breaking Changes

### Current Release (0.2.0)
✅ **None** - Fully backward compatible

### Future Release (1.0.0)
⚠️ **Breaking Changes Planned**:
- `get_boosts` will be removed
- `prune_expired_boosts` will be removed
- All functionality available via recommended APIs
- 6-month grace period provided

## Related Issues

- SW-CONTRACT-BOOST-001 - Test coverage improvements (completed)
- SW-CONTRACT-BOOST-002 - Deprecation path (this PR)

## References

- [Soroban Contract Upgrades](https://soroban.stellar.org/docs/advanced-tutorials/upgradeable-contracts)
- [Stellar Best Practices](https://developers.stellar.org/docs/smart-contracts/best-practices)
- [Semantic Versioning](https://semver.org/)

## Reviewer Checklist

- [ ] Code review complete
- [ ] All tests pass locally
- [ ] CI green
- [ ] Documentation reviewed
- [ ] Migration guide clear
- [ ] No security concerns
- [ ] Backward compatibility verified
- [ ] Deprecation events work correctly

## Post-Merge Tasks

- [ ] Deploy to testnet
- [ ] Monitor deprecation events
- [ ] Notify integrators
- [ ] Update client SDKs
- [ ] Track migration progress
- [ ] Schedule v1.0.0 removal

---

**Status**: ✅ Ready for Review  
**Estimated Review Time**: 1-2 hours  
**Estimated Merge**: Within 1-2 business days  
**Next Release**: v1.0.0 (Q4 2026) - Removal of deprecated functions
