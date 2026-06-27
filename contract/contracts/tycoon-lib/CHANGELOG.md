# Changelog - tycoon-lib

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Crate-level rustdoc (`//!`) in `lib.rs` documenting modules, design notes, and
  acceptance criteria for all public APIs.
- Module-level rustdoc (`//!`) in `fees.rs` covering invariants, fee-component table,
  and rounding behaviour.
- Inline field-level doc comments on `FeeConfig` and `FeeSplit` struct fields.
- Doc comment on `calculate_fee_split` describing the invalid-config fallback.
- Doc comment on `FeeConfig::is_valid` clarifying the 10 000 bps ceiling.
- `#[deprecated]` re-exports in `legacy` module for consumers that referenced items
  by their old paths before the `fees` module was extracted (see deprecation path below).

### Changed
- Clarified the comment about `pause` removal to reference the canonical
  `tycoon-main-game/src/storage.rs` implementation.

## [0.1.0] - 2026-03-27

### Added
- Initial Soroban implementation.
- State schema versioning (#413).
- `GameStatus` enum (`Pending`, `Ongoing`, `Ended`).
- `GameType` enum (`PublicGame`, `PrivateGame`).
- `PlayerSymbol` enum with 8 classic board-game piece variants.
- `fees` module with `FeeConfig`, `FeeSplit`, and `calculate_fee_split`.
