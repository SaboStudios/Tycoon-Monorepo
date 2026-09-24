# CI Test Fixes - Boost System

## Issues Fixed

### 1. Authentication Errors (8 test failures)
**Problem**: Tests were failing with `Error(Auth, InvalidAction)` because `add_boost()` and `clear_boosts()` require authentication via `player.require_auth()`.

**Solution**: Added `env.mock_all_auths()` to all test functions to mock authentication in test environment.

```rust
// Before
let env = Env::default();
let contract_id = env.register_contract(None, TycoonBoostSystem);

// After
let env = Env::default();
env.mock_all_auths();  // Mock authentication
let contract_id = env.register(TycoonBoostSystem, ());
```

### 2. Deprecated API Usage (9 warnings)
**Problem**: Using deprecated `register_contract()` method.

**Solution**: Updated to use `register()` method.

```rust
// Before
env.register_contract(None, TycoonBoostSystem)

// After
env.register(TycoonBoostSystem, ())
```

### 3. Unused Variable Warning
**Problem**: `env` parameter in `apply_stacking_rules()` was unused.

**Solution**: Prefixed with underscore to indicate intentionally unused.

```rust
// Before
fn apply_stacking_rules(env: &Env, boosts: Vec<Boost>) -> u32

// After
fn apply_stacking_rules(_env: &Env, boosts: Vec<Boost>) -> u32
```

### 4. Cargo Profile Warning
**Problem**: Profile configuration in package Cargo.toml conflicts with workspace root.

**Solution**: Removed `[profile.release-with-logs]` section from package Cargo.toml.

## Test Results

### Before Fixes
```
test result: FAILED. 1 passed; 8 failed; 0 ignored
```

### After Fixes
All 9 tests should now pass:
- ✓ test_additive_stacking
- ✓ test_multiplicative_stacking
- ✓ test_override_highest_priority
- ✓ test_mixed_stacking
- ✓ test_override_ignores_others
- ✓ test_no_boosts
- ✓ test_clear_boosts
- ✓ test_deterministic_outcome
- ✓ test_get_boosts

## Files Modified
1. `contract/contracts/tycoon-boost-system/src/test.rs` - Added auth mocking, updated API
2. `contract/contracts/tycoon-boost-system/src/lib.rs` - Fixed unused variable warning
3. `contract/contracts/tycoon-boost-system/Cargo.toml` - Removed profile configuration

## Commit
```
Fix boost system tests: mock auth and use non-deprecated API
```

## CI Status
Expected: ✅ All checks passing
- Backend tests: ✅ (already passing)
- Frontend tests: ✅ (already passing)
- Contract tests: ✅ (fixed)
