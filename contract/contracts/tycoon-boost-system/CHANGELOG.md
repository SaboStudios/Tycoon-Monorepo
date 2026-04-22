# Changelog - tycoon-boost-system

All notable changes to this project will be documented in this file.

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
