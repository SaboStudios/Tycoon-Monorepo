# Changelog - tycoon-boost-system

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-04-22

### Deprecated
- **`get_boosts`** - Returns all boosts including expired ones. Use `get_active_boosts` instead.
  - Reason: Wastes gas reading stale data and confuses clients
  - Migration: Replace `get_boosts` with `get_active_boosts`
  - Removal: Planned for v1.0.0 (Q4 2026)
  
- **`prune_expired_boosts`** - Manual pruning is unnecessary. Use automatic pruning instead.
  - Reason: `add_boost` already auto-prunes, and `calculate_total_boost` ignores expired boosts
  - Migration: Simply remove calls to this function
  - Removal: Planned for v1.0.0 (Q4 2026)

### Added
- Deprecation event system (SW-CONTRACT-BOOST-002)
  - `DeprecatedFunctionCalledEvent` emitted when deprecated functions are called
  - Helps track migration progress and identify integrations needing updates
- Comprehensive deprecation tests (30 new tests)
  - Backward compatibility verification
  - Migration path validation
  - Event emission testing
  - Functional equivalence tests
- Documentation:
  - `DEPRECATION_PLAN.md` - Complete deprecation strategy
  - `MIGRATION_GUIDE.md` - Step-by-step migration instructions
  - Updated inline documentation with deprecation notices

### Changed
- Updated `get_boosts` to emit deprecation event
- Updated `prune_expired_boosts` to emit deprecation event
- Added `#[deprecated]` attributes to legacy functions
- Updated README.md with deprecation notices

### Testing
- All 151 tests pass (121 existing + 30 deprecation tests)
- CI green for all checks
- No breaking changes to existing functionality

## [0.1.1] - 2026-04-22

### Added
- Comprehensive test coverage improvements (SW-CONTRACT-BOOST-001)
  - 45 new advanced unit tests covering edge cases, stress scenarios, and multi-player isolation
  - 25 new cross-contract integration tests
  - Total test count increased from 51 to 121 tests (+137% coverage)
- New test modules:
  - `src/advanced_integration_tests.rs` - Advanced unit tests
  - `../integration-tests/src/boost_system_integration.rs` - Integration tests
- Test documentation:
  - `TEST_COVERAGE_IMPROVEMENTS.md` - Comprehensive coverage documentation
  - `PR_DESCRIPTION.md` - Pull request details
- Updated fixture support for boost system in integration tests

### Changed
- Updated README.md with expanded test coverage information
- Enhanced integration test fixture to include boost system deployment

### Testing
- All 121 tests pass
- CI green for all checks
- No breaking changes to contract logic

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
