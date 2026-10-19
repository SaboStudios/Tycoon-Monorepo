#![no_std]

// Pause module removed - each contract implements pause locally for better isolation
// See tycoon-main-game/src/storage.rs for pause implementation example
pub mod fees;

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
#[derive(Clone, Debug, Eq, PartialEq)]
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
#[derive(Clone, Debug, Eq, PartialEq)]
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
#[derive(Clone, Debug, Eq, PartialEq)]
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
    use soroban_sdk::{Env, IntoVal, Symbol, TryFromVal, Val, xdr::ScVal};

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

    // ========================================================
    // ABI stability tests
    // ========================================================
    //
    // These tests pin the Soroban `#[contracttype]` encoding of each
    // enum variant.
    //
    // A unit-only `#[contracttype]` enum is encoded as a one-element
    // `ScVal::Vec` holding the variant's name as an `ScVal::Symbol`
    // (verified against soroban-sdk v23.5.3). For example
    // `GameStatus::Pending` encodes as `Vec([Symbol("Pending")])`.
    //
    // Because the variant *name* is what ends up on the wire, renaming a
    // variant is an ABI break just as much as reordering one. These
    // assertions therefore pin the exact wire form of every variant and
    // guard cross-contract/client compatibility with the `TycoonLib.sol`
    // mirror.

    /// Asserts that `value` encodes to a one-element vec holding
    /// `expected_name` as its symbol, and that it round-trips back.
    fn assert_encoded_variant_name<T>(env: &Env, value: T, expected_name: &str)
    where
        T: IntoVal<Env, Val> + TryFromVal<Env, Val> + Clone + PartialEq + core::fmt::Debug,
    {
        let encoded: Val = value.clone().into_val(env);

        // The encoded form must be `Vec([Symbol(expected_name)])`.
        let expected: Val = (Symbol::new(env, expected_name),).into_val(env);
        assert_eq!(
            ScVal::try_from_val(env, &encoded).expect("encoded value should convert to ScVal"),
            ScVal::try_from_val(env, &expected).expect("expected value should convert to ScVal"),
            "encoded variant mismatch for {:?}",
            value
        );

        // And it must round-trip back to the original variant.
        let decoded = T::try_from_val(env, &encoded).expect("value should decode");
        assert_eq!(decoded, value);
    }

    #[test]
    fn test_game_status_abi_encoding_is_stable() {
        let env = Env::default();

        assert_encoded_variant_name(&env, GameStatus::Pending, "Pending");
        assert_encoded_variant_name(&env, GameStatus::Ongoing, "Ongoing");
        assert_encoded_variant_name(&env, GameStatus::Ended, "Ended");
    }

    #[test]
    fn test_game_type_abi_encoding_is_stable() {
        let env = Env::default();

        assert_encoded_variant_name(&env, GameType::PublicGame, "PublicGame");
        assert_encoded_variant_name(&env, GameType::PrivateGame, "PrivateGame");
    }

    #[test]
    fn test_player_symbol_abi_encoding_is_stable() {
        let env = Env::default();

        assert_encoded_variant_name(&env, PlayerSymbol::Hat, "Hat");
        assert_encoded_variant_name(&env, PlayerSymbol::Car, "Car");
        assert_encoded_variant_name(&env, PlayerSymbol::Dog, "Dog");
        assert_encoded_variant_name(&env, PlayerSymbol::Thimble, "Thimble");
        assert_encoded_variant_name(&env, PlayerSymbol::Iron, "Iron");
        assert_encoded_variant_name(&env, PlayerSymbol::Battleship, "Battleship");
        assert_encoded_variant_name(&env, PlayerSymbol::Boot, "Boot");
        assert_encoded_variant_name(&env, PlayerSymbol::Wheelbarrow, "Wheelbarrow");
    }
}

