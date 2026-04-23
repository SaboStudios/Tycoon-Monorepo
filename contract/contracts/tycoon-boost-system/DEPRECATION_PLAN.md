# Deprecation Plan - Tycoon Boost System

**Issue**: SW-CONTRACT-BOOST-002  
**Title**: Deprecation Path for Legacy Entrypoints  
**Date**: April 22, 2026  
**Status**: 🚧 In Progress  

## Overview

This document outlines the deprecation strategy for legacy entrypoints in the `tycoon-boost-system` Soroban contract, following Stellar/Soroban best practices for contract evolution.

## Legacy Entrypoints Identified

Based on API design review, the following entrypoints are candidates for deprecation:

### 1. `get_boosts` (Legacy)
**Reason**: Returns ALL boosts including expired ones, which:
- Wastes gas reading expired data
- Confuses clients (expired boosts shouldn't be used)
- Duplicates functionality with `get_active_boosts`

**Replacement**: `get_active_boosts` (already exists)

### 2. `prune_expired_boosts` (Legacy)
**Reason**: Manual pruning is unnecessary because:
- `add_boost` already auto-prunes before adding
- `calculate_total_boost` ignores expired boosts
- Adds unnecessary complexity for clients

**Replacement**: Automatic pruning (already implemented internally)

## Deprecation Strategy

### Phase 1: Mark as Deprecated (Current Release)
- Add `#[deprecated]` attributes to legacy functions
- Add deprecation warnings in documentation
- Emit deprecation events when legacy functions are called
- Update client SDKs with deprecation notices

### Phase 2: Grace Period (3-6 months)
- Monitor usage via deprecation events
- Notify known integrators
- Provide migration guides
- Keep legacy functions fully functional

### Phase 3: Removal (Future Release)
- Remove deprecated functions in next major version
- Ensure all clients have migrated
- Update contract version to 1.0.0

## Implementation Approach

### 1. Add Deprecation Events
```rust
#[contractevent]
pub struct DeprecatedFunctionCalledEvent {
    #[topic]
    pub function_name: Symbol,
    #[topic]
    pub caller: Address,
    pub replacement: Symbol,
}
```

### 2. Wrap Legacy Functions
- Keep original functionality
- Emit deprecation event
- Add inline documentation

### 3. Add New Versioned API
- `get_active_boosts_v2` with pagination support
- Improved error handling
- Better gas efficiency

## Migration Guide

### For `get_boosts` → `get_active_boosts`

**Before (Legacy)**:
```rust
let all_boosts = client.get_boosts(&player);
// Client must filter expired boosts manually
```

**After (Recommended)**:
```rust
let active_boosts = client.get_active_boosts(&player);
// Only active boosts returned
```

### For `prune_expired_boosts` → Automatic

**Before (Legacy)**:
```rust
// Manual pruning
client.prune_expired_boosts(&player);
let total = client.calculate_total_boost(&player);
```

**After (Recommended)**:
```rust
// Automatic pruning - just calculate
let total = client.calculate_total_boost(&player);
```

## Backward Compatibility

### Guarantees
✅ Legacy functions remain functional during grace period  
✅ No breaking changes to existing integrations  
✅ Clear migration path provided  
✅ Deprecation warnings in all channels  

### Breaking Changes (Future v1.0.0)
⚠️ `get_boosts` will be removed  
⚠️ `prune_expired_boosts` will be removed  
✅ All functionality available via recommended APIs  

## Monitoring

### Metrics to Track
- Deprecation event count per function
- Unique callers of deprecated functions
- Migration progress over time

### Alerts
- Weekly report of deprecated function usage
- Notify team when usage drops below threshold
- Alert if new integrations use deprecated APIs

## Testing Strategy

### Test Coverage
✅ Deprecated functions still work correctly  
✅ Deprecation events are emitted  
✅ Replacement functions provide same functionality  
✅ Migration examples work as documented  

### Test Files
- `src/deprecation_tests.rs` - Deprecation behavior tests
- `integration-tests/src/deprecation_migration.rs` - Migration scenarios

## Documentation Updates

### Files to Update
- ✅ `README.md` - Add deprecation notices
- ✅ `CHANGELOG.md` - Document deprecation
- ✅ `QUICK_REFERENCE.md` - Mark deprecated APIs
- ✅ Client SDK docs - Add migration guides

## Rollout Checklist

### Phase 1: Implementation
- [ ] Add deprecation events
- [ ] Wrap legacy functions with deprecation logic
- [ ] Add comprehensive tests
- [ ] Update documentation
- [ ] Create migration guide

### Phase 2: Deployment
- [ ] Deploy to testnet
- [ ] Monitor deprecation events
- [ ] Notify integrators
- [ ] Update client SDKs

### Phase 3: Monitoring
- [ ] Track usage metrics
- [ ] Support migration questions
- [ ] Prepare for removal

### Phase 4: Removal (Future)
- [ ] Verify zero usage
- [ ] Remove deprecated functions
- [ ] Release v1.0.0
- [ ] Update all documentation

## Security Considerations

✅ No new attack vectors introduced  
✅ Deprecation events don't leak sensitive data  
✅ Legacy functions maintain same security properties  
✅ No privilege escalation possible  

## Gas Impact

### Deprecation Event Cost
- ~1,000 gas per deprecated function call
- Acceptable overhead during grace period
- Removed in v1.0.0 when functions are deleted

### Optimization Opportunities
- Removing `get_boosts` saves storage reads
- Removing `prune_expired_boosts` simplifies client logic

## Success Criteria

✅ All deprecated functions marked and documented  
✅ Deprecation events implemented and tested  
✅ Migration guide complete and tested  
✅ CI green for all changes  
✅ No breaking changes in current release  
✅ Clear timeline for removal  

## Timeline

| Phase | Duration | Target Date |
|-------|----------|-------------|
| Implementation | 1 week | April 29, 2026 |
| Testnet Deploy | 1 week | May 6, 2026 |
| Grace Period | 3-6 months | Aug-Nov 2026 |
| Removal (v1.0.0) | TBD | Q4 2026 |

## References

- [Soroban Contract Upgrades](https://soroban.stellar.org/docs/advanced-tutorials/upgradeable-contracts)
- [Stellar Best Practices](https://developers.stellar.org/docs/smart-contracts/best-practices)
- [Semantic Versioning](https://semver.org/)

---

**Status**: 🚧 Ready for Implementation  
**Next Step**: Implement deprecation logic and tests
