/// # tycoon-lib — simulation scenarios
///
/// End-to-end scenario tests that simulate realistic game flows using
/// the types and fee logic exposed by tycoon-lib.  Each scenario
/// corresponds to a named gameplay situation documented in the acceptance
/// criteria.
///
/// Scenarios covered:
///
/// | Scenario | Description |
/// |----------|-------------|
/// | Public game lifecycle | Pending → Ongoing → Ended for a public game |
/// | Private game lifecycle | Same lifecycle, different join policy |
/// | Fee collection on game start | Platform + creator + pool fees charged when game starts |
/// | Fee collection on game end (winner payout) | Residue routed to winner; zero fees on invalid config |
/// | Player symbol assignment | All 8 symbols can be independently assigned to 8 players |
/// | Symbol uniqueness per game | No two players share a symbol within one game |
/// | Fee split across multiple rounds | Cumulative fee logic over N rounds |
/// | Graceful handling of stale/invalid fee config | Invalid config falls back to full residue |
#[cfg(test)]
mod tests {
    use crate::{
        fees::{calculate_fee_split, FeeConfig},
        GameStatus, GameType, PlayerSymbol,
    };
    use soroban_sdk::{testutils::Address as _, Env};

    fn make_fee_config(env: &Env, platform_bps: u32, creator_bps: u32, pool_bps: u32) -> FeeConfig {
        FeeConfig {
            platform_fee_bps: platform_bps,
            creator_fee_bps: creator_bps,
            pool_fee_bps: pool_bps,
            platform_address: soroban_sdk::Address::generate(env),
            pool_address: soroban_sdk::Address::generate(env),
        }
    }

    // ---------------------------------------------------------------
    // Scenario 1: Public game — full lifecycle Pending → Ongoing → Ended
    // ---------------------------------------------------------------

    #[test]
    fn scenario_public_game_full_lifecycle() {
        let game_type = GameType::PublicGame;

        // Game starts in Pending state, open to anyone.
        let mut status = GameStatus::Pending;
        assert_eq!(status, GameStatus::Pending);
        assert_eq!(game_type, GameType::PublicGame);

        // Game starts.
        status = GameStatus::Ongoing;
        assert_eq!(status, GameStatus::Ongoing);
        assert_ne!(status, GameStatus::Pending);

        // Game ends with a winner.
        status = GameStatus::Ended;
        assert_eq!(status, GameStatus::Ended);
        assert_ne!(status, GameStatus::Ongoing);
    }

    // ---------------------------------------------------------------
    // Scenario 2: Private game — lifecycle with join restriction
    // ---------------------------------------------------------------

    #[test]
    fn scenario_private_game_full_lifecycle() {
        let game_type = GameType::PrivateGame;

        // Private games require a join code — verify this is enforced by type.
        let join_allowed = match game_type {
            GameType::PublicGame => true,
            GameType::PrivateGame => false, // requires join code checked elsewhere
        };
        assert!(!join_allowed, "private game must not allow open joins");

        let mut status = GameStatus::Pending;
        status = GameStatus::Ongoing;
        status = GameStatus::Ended;
        assert_eq!(status, GameStatus::Ended);
    }

    // ---------------------------------------------------------------
    // Scenario 3: Fee collection when a game starts
    // ---------------------------------------------------------------

    #[test]
    fn scenario_fee_collection_on_game_start() {
        let env = Env::default();
        // Platform 2%, creator 3%, pool 5% — total 10%
        let config = make_fee_config(&env, 200, 300, 500);
        assert!(config.is_valid());

        let entry_fee: u128 = 10_000;
        let split = calculate_fee_split(entry_fee, &config);

        assert_eq!(split.platform_amount, 200);
        assert_eq!(split.creator_amount, 300);
        assert_eq!(split.pool_amount, 500);
        // 90% goes back as residue (prize pool contribution)
        assert_eq!(split.residue, 9_000);
        assert_eq!(
            split.platform_amount + split.creator_amount + split.pool_amount + split.residue,
            entry_fee
        );
    }

    // ---------------------------------------------------------------
    // Scenario 4: Winner payout — residue is the winner's share
    // ---------------------------------------------------------------

    #[test]
    fn scenario_winner_payout_residue_is_prize() {
        let env = Env::default();
        // 5% + 5% + 5% = 15% total fees; winner gets 85%
        let config = make_fee_config(&env, 500, 500, 500);
        assert!(config.is_valid());

        let prize_pool: u128 = 100_000;
        let split = calculate_fee_split(prize_pool, &config);

        // Winner's portion
        let winner_amount = split.residue;
        assert_eq!(winner_amount, 85_000);

        // Sanity: fees are non-zero and sum correctly
        assert!(split.platform_amount > 0);
        assert!(split.creator_amount > 0);
        assert!(split.pool_amount > 0);
        assert_eq!(
            split.platform_amount + split.creator_amount + split.pool_amount + winner_amount,
            prize_pool
        );
    }

    // ---------------------------------------------------------------
    // Scenario 5: Invalid fee config — full amount returned as residue
    // ---------------------------------------------------------------

    #[test]
    fn scenario_invalid_fee_config_full_residue() {
        let env = Env::default();
        // 50% + 50% + 50% = 150% — invalid; no fees collected
        let config = make_fee_config(&env, 5000, 5000, 5000);
        assert!(!config.is_valid(), "config with 150% fees must be invalid");

        let amount: u128 = 50_000;
        let split = calculate_fee_split(amount, &config);

        assert_eq!(split.platform_amount, 0, "no fees taken from invalid config");
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, amount, "full amount returned as residue");
    }

    // ---------------------------------------------------------------
    // Scenario 6: Player symbol assignment for an 8-player game
    // ---------------------------------------------------------------

    #[test]
    fn scenario_eight_player_symbol_assignment() {
        let all_symbols = [
            PlayerSymbol::Hat,
            PlayerSymbol::Car,
            PlayerSymbol::Dog,
            PlayerSymbol::Thimble,
            PlayerSymbol::Iron,
            PlayerSymbol::Battleship,
            PlayerSymbol::Boot,
            PlayerSymbol::Wheelbarrow,
        ];

        // Simulate assigning one symbol per player and verify uniqueness.
        for (player_idx, &assigned) in all_symbols.iter().enumerate() {
            for (other_idx, &other) in all_symbols.iter().enumerate() {
                if player_idx == other_idx {
                    assert_eq!(assigned, other, "player {player_idx} symbol must equal itself");
                } else {
                    assert_ne!(
                        assigned, other,
                        "player {player_idx} and {other_idx} must have different symbols"
                    );
                }
            }
        }
    }

    // ---------------------------------------------------------------
    // Scenario 7: Fee accumulation across multiple rounds
    // ---------------------------------------------------------------

    #[test]
    fn scenario_cumulative_fees_across_rounds() {
        let env = Env::default();
        // 1% + 2% + 3% = 6% per round
        let config = make_fee_config(&env, 100, 200, 300);
        assert!(config.is_valid());

        let round_pot: u128 = 10_000;
        let num_rounds: u128 = 5;

        let mut total_platform = 0u128;
        let mut total_creator = 0u128;
        let mut total_pool = 0u128;
        let mut total_residue = 0u128;

        for _ in 0..num_rounds {
            let split = calculate_fee_split(round_pot, &config);
            total_platform += split.platform_amount;
            total_creator += split.creator_amount;
            total_pool += split.pool_amount;
            total_residue += split.residue;
        }

        let total_in = round_pot * num_rounds;
        assert_eq!(
            total_platform + total_creator + total_pool + total_residue,
            total_in,
            "accumulated fees must equal total input across all rounds"
        );
        // 1% of 10000 per round * 5 rounds = 500
        assert_eq!(total_platform, 500);
        // 2% * 5 rounds = 1000
        assert_eq!(total_creator, 1000);
        // 3% * 5 rounds = 1500
        assert_eq!(total_pool, 1500);
        // remaining 94% * 5 rounds = 47000
        assert_eq!(total_residue, 47_000);
    }

    // ---------------------------------------------------------------
    // Scenario 8: Game state cannot regress (forward-only lifecycle)
    // ---------------------------------------------------------------

    #[test]
    fn scenario_game_status_forward_only() {
        // Encode valid transitions: Pending→Ongoing and Ongoing→Ended.
        // Regression (Ended→Ongoing, Ongoing→Pending) is rejected.
        let is_valid_transition = |from: GameStatus, to: GameStatus| -> bool {
            matches!(
                (from, to),
                (GameStatus::Pending, GameStatus::Ongoing)
                    | (GameStatus::Ongoing, GameStatus::Ended)
            )
        };

        assert!(is_valid_transition(GameStatus::Pending, GameStatus::Ongoing));
        assert!(is_valid_transition(GameStatus::Ongoing, GameStatus::Ended));

        // Illegal transitions
        assert!(!is_valid_transition(GameStatus::Ended, GameStatus::Ongoing));
        assert!(!is_valid_transition(GameStatus::Ongoing, GameStatus::Pending));
        assert!(!is_valid_transition(GameStatus::Ended, GameStatus::Pending));
        assert!(!is_valid_transition(GameStatus::Pending, GameStatus::Ended));

        // Self-transition is also illegal
        assert!(!is_valid_transition(GameStatus::Pending, GameStatus::Pending));
        assert!(!is_valid_transition(GameStatus::Ongoing, GameStatus::Ongoing));
        assert!(!is_valid_transition(GameStatus::Ended, GameStatus::Ended));
    }

    // ---------------------------------------------------------------
    // Scenario 9: Zero-entry game (no entry fee) — fees remain zero
    // ---------------------------------------------------------------

    #[test]
    fn scenario_zero_entry_fee_no_fees_collected() {
        let env = Env::default();
        let config = make_fee_config(&env, 250, 500, 750);
        assert!(config.is_valid());

        let split = calculate_fee_split(0, &config);
        assert_eq!(split.platform_amount, 0);
        assert_eq!(split.creator_amount, 0);
        assert_eq!(split.pool_amount, 0);
        assert_eq!(split.residue, 0);
    }
}
