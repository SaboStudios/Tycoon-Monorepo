# Changelog - tycoon-boost-system

All notable changes to this project will be documented in this file.

## [Unreleased] - SW-CON-1038

### Added
- **Enhanced admin access control test coverage** — Comprehensive review and expansion of authorization tests
  - Added 25+ new test scenarios covering all admin functions
  - Added negative authorization tests for all admin-only functions
  - Added state isolation verification tests
  - Added no-auth verification for read-only functions
  - Added security attack vector tests (privilege escalation, auth bypass)
  - Added edge case tests (max values, capacity limits, ID reuse)
  - Total admin access control tests: 40+ (previously 25)
- Documentation:
  - `ADMIN_ACCESS_CONTROL_TEST_COVERAGE.md` - Complete test coverage report with matrix
  - Test coverage matrix documenting all 40+ test scenarios (AAC-01 through AAC-24+)
- Test categories:
  - Authorization enforcement (10 tests)
  - Input validation (4 tests)
  - State isolation (5 tests)
  - Edge cases (5 tests)
  - Read-only access (3 tests)
  - Security vectors (5 tests)
  - Integration scenarios (8+ tests)

### Changed
- Enhanced `src/admin_access_control_tests.rs` with comprehensive test coverage
- Updated README.md test coverage section (191+ total tests, up from 151)
- Improved test documentation with detailed test ID matrix

### Testing
- All 191+ tests pass
- 100% coverage of admin access control paths
- All authorization checks verified
- All error conditions tested

## [Unreleased] - SW-CT-027

### Added
- `src/simulation_scenarios.rs` — 7 end-to-end game-session simulation tests:
  SIM-01 new player receives admin boost, SIM-02 boost expires mid-session,
  SIM-03 admin revokes mid-session, SIM-04 cap freed by expiry allows new boost,
  SIM-05 multi-player isolation, SIM-06 mixed boost types full round,
  SIM-07 end-of-season clear all players.

## [Unreleased] - SW-CT-025

### Added
- `SECURITY_REVIEW_CHECKLIST.md` — full security review covering authorization,
  input validation, arithmetic safety, expiry logic, event emission, and storage.
  Four findings documented (SEC-01 through SEC-04).
- `src/security_review_tests.rs` — 4 tests targeting the findings:
  - `test_admin_grant_boost_rejects_without_auth` (SEC-01)
  - `test_admin_revoke_boost_rejects_without_auth` (SEC-01)
  - `test_additive_overflow_wraps` (SEC-02 — documents current wrapping behavior)
  - `test_mixed_overflow_truncates` (SEC-03 — documents current truncation behavior)

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
