//! # tycoon-lib
//!
//! Shared types and utilities for the Tycoon Soroban smart-contract suite.
//!
//! ## Modules
//!
//! | Module | Purpose |
//! |--------|---------|
//! | *(root)* | Core game enum types: [`GameStatus`], [`GameType`], [`PlayerSymbol`] |
//! | [`fees`] | Fee configuration and split calculation: [`fees::FeeConfig`], [`fees::FeeSplit`], [`fees::calculate_fee_split`] |
//!
//! ## Design notes
//!
//! All types derive [`Clone`], [`Copy`], [`Debug`], [`Eq`], and [`PartialEq`] and are
//! annotated with `#[contracttype]` so they can be used directly in Soroban contract
//! storage and function signatures.
//!
//! The `pause` module that previously lived here has been removed; each downstream
//! contract now manages its own pause flag for better isolation.
//! See `tycoon-main-game/src/storage.rs` for the canonical pause implementation.
//!
//! ## Acceptance criteria
//!
//! - All public items are documented with rustdoc comments.
//! - [`fees::FeeConfig::is_valid`] rejects any config whose basis-points sum exceeds 10 000.
//! - [`fees::calculate_fee_split`] guarantees `platform + creator + pool + residue == amount`
//!   for every valid input.
//! - An invalid [`fees::FeeConfig`] causes [`fees::calculate_fee_split`] to return the full
//!   `amount` as `residue` with all fee fields set to zero (graceful degradation).

#![no_std]

// Pause module removed — each contract implements pause locally for better isolation.
// See tycoon-main-game/src/storage.rs for the canonical pause implementation.
// Pause module removed - each contract implements pause locally for better isolation.
// See tycoon-main-game/src/storage.rs for the canonical pause implementation.
pub mod fees;

/// Deprecated re-exports for consumers using pre-0.2.0 import paths.
///
/// All items in this module emit `#[deprecated]` compiler warnings.
/// See the module documentation for the replacement path of each item.
pub mod legacy;
// Pause module removed - each contract implements pause locally for better isolation
// See tycoon-main-game/src/storage.rs for pause implementation example
pub mod events;
pub mod fees;

// Admin-only vs public entrypoint formalization (SW-LIB-001)
pub mod admin;

// Storage rent budget review and TTL helpers (SW-LIB-002)
pub mod storage_rent;

// Cross-contract auth matrix types (SW-LIB-003)
pub mod auth;

// Upgrade / migration key governance (SW-LIB-004)
pub mod migration;

#[cfg(test)]
mod fees_coverage_tests;

#[cfg(test)]
mod simulation_tests;

use soroban_sdk::contracttype;

// ============================================================
// GameStatus
// ============================================================

/// Represents the lifecycle state of a Tycoon game.
///
/// Mirrors `TycoonLib.sol` `GameStatus` enum.
///
/// - `Pending`  — Game has been created and is waiting for players to join.
/// - `Ongoing`  — Game has started and is currently in progress.
/// - `Ended`    — Game has finished; a winner has been determined.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GameStatus {
    /// Game created, accepting players.
    Pending,
    /// Game is actively being played.
    Ongoing,
    /// Game has concluded.
    Ended,
}

// ============================================================
// GameType
// ============================================================

/// Determines who can join a Tycoon game.
///
/// Mirrors `TycoonLib.sol` `GameType` enum.
///
/// - `PublicGame`  — Anyone can discover and join the game.
/// - `PrivateGame` — Requires a join code to enter.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum GameType {
    /// Open to any registered player.
    PublicGame,
    /// Restricted; requires a matching join code.
    PrivateGame,
}

// ============================================================
// PlayerSymbol
// ============================================================

/// The game piece (token) a player chooses to represent them on the board.
///
/// Mirrors `TycoonLib.sol` `PlayerSymbol` enum.
/// Each variant corresponds to a classic Monopoly-style playing piece.
///
/// - `Hat`         — Top hat piece.
/// - `Car`         — Racing car piece.
/// - `Dog`         — Scottie dog piece.
/// - `Thimble`     — Thimble piece.
/// - `Iron`        — Iron piece.
/// - `Battleship`  — Battleship piece.
/// - `Boot`        — Boot piece.
/// - `Wheelbarrow` — Wheelbarrow piece.
#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PlayerSymbol {
    /// Classic top hat token.
    Hat,
    /// Racing car token.
    Car,
    /// Scottie dog token.
    Dog,
    /// Thimble token.
    Thimble,
    /// Iron token.
    Iron,
    /// Battleship token.
    Battleship,
    /// Boot token.
    Boot,
    /// Wheelbarrow token.
    Wheelbarrow,
}

// ============================================================
// Tests
// ============================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_game_status_variants_compile_and_are_distinct() {
        let pending = GameStatus::Pending;
        let ongoing = GameStatus::Ongoing;
        let ended = GameStatus::Ended;

        assert_eq!(pending, GameStatus::Pending);
        assert_eq!(ongoing, GameStatus::Ongoing);
        assert_eq!(ended, GameStatus::Ended);

        assert_ne!(pending, ongoing);
        assert_ne!(ongoing, ended);
        assert_ne!(pending, ended);
    }

    #[test]
    fn test_game_type_variants_compile_and_are_distinct() {
        let public_game = GameType::PublicGame;
        let private_game = GameType::PrivateGame;

        assert_eq!(public_game, GameType::PublicGame);
        assert_eq!(private_game, GameType::PrivateGame);

        assert_ne!(public_game, private_game);
    }

    #[test]
    fn test_player_symbol_all_variants_compile() {
        let symbols = [
            PlayerSymbol::Hat,
            PlayerSymbol::Car,
            PlayerSymbol::Dog,
            PlayerSymbol::Thimble,
            PlayerSymbol::Iron,
            PlayerSymbol::Battleship,
            PlayerSymbol::Boot,
            PlayerSymbol::Wheelbarrow,
        ];

        // Each variant is equal only to itself
        for (i, symbol) in symbols.iter().enumerate() {
            for (j, other) in symbols.iter().enumerate() {
                if i == j {
                    assert_eq!(symbol, other);
                } else {
                    assert_ne!(symbol, other);
                }
            }
        }
    }

    #[test]
    fn test_types_can_be_cloned() {
        let status = GameStatus::Ongoing;
        let status_clone = status.clone();
        assert_eq!(status, status_clone);

        let game_type = GameType::PrivateGame;
        let game_type_clone = game_type.clone();
        assert_eq!(game_type, game_type_clone);

        let symbol = PlayerSymbol::Battleship;
        let symbol_clone = symbol.clone();
        assert_eq!(symbol, symbol_clone);
    }

    #[test]
    fn test_game_status_used_in_match() {
        let status = GameStatus::Pending;
        let label = match status {
            GameStatus::Pending => "waiting for players",
            GameStatus::Ongoing => "in progress",
            GameStatus::Ended => "finished",
        };
        assert_eq!(label, "waiting for players");
    }

    #[test]
    fn test_game_type_used_in_match() {
        let game_type = GameType::PrivateGame;
        let requires_code = match game_type {
            GameType::PublicGame => false,
            GameType::PrivateGame => true,
        };
        assert!(requires_code);
    }

    #[test]
    fn test_player_symbol_used_in_match() {
        let symbol = PlayerSymbol::Dog;
        let name = match symbol {
            PlayerSymbol::Hat => "Hat",
            PlayerSymbol::Car => "Car",
            PlayerSymbol::Dog => "Dog",
            PlayerSymbol::Thimble => "Thimble",
            PlayerSymbol::Iron => "Iron",
            PlayerSymbol::Battleship => "Battleship",
            PlayerSymbol::Boot => "Boot",
            PlayerSymbol::Wheelbarrow => "Wheelbarrow",
        };
        assert_eq!(name, "Dog");
    }
}
