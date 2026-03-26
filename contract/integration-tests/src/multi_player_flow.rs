/// # Cross-contract flow: Multi-player end-to-end (#411)
///
/// These tests exercise complete game session flows involving multiple contracts
/// and multiple players in a single environment.
///
/// ## Paths covered
///
/// | Test | Path |
/// |------|------|
/// | `full_session_register_reward_withdraw` | Register → mint voucher → redeem → game withdraw |
/// | `three_players_independent_vouchers` | Three players each get and redeem their own voucher |
/// | `reward_fund_depletes_correctly` | Cumulative redemptions reduce reward contract balance |
/// | `game_and_reward_share_same_token` | Both contracts use the same TYC token address |
/// | `player_balance_zero_before_redeem` | Player has no TYC until they redeem |
/// | `admin_can_withdraw_from_both_contracts` | Admin withdraws from game and reward independently |
#[cfg(test)]
mod tests {
    use crate::fixture::{Fixture, REWARD_FUND};
    use soroban_sdk::String;

    /// Full session: register player → mint reward voucher → player redeems → admin withdraws.
    #[test]
    fn full_session_register_reward_withdraw() {
        let f = Fixture::new();

        // 1. Register player
        f.game
            .register_player(&String::from_str(&f.env, "alice"), &f.player_a);
        assert!(f.game.get_user(&f.player_a).is_some());

        // 2. Admin mints a reward voucher for the player
        let reward_value: u128 = 100_000_000_000_000_000_000; // 100 TYC
        let token_id = f
            .reward
            .mint_voucher(&f.admin, &f.player_a, &reward_value);

        // 3. Player redeems voucher — TYC flows from reward contract to player
        let reward_before = f.tyc_balance(&f.reward_id);
        f.reward.redeem_voucher_from(&f.player_a, &token_id);

        assert_eq!(f.tyc_balance(&f.player_a), reward_value as i128);
        assert_eq!(
            f.tyc_balance(&f.reward_id),
            reward_before - reward_value as i128
        );

        // 4. Admin withdraws from game contract
        let withdraw: u128 = 50_000_000_000_000_000_000_000; // 50 000 TYC
        let game_before = f.tyc_balance(&f.game_id);
        f.game.withdraw_funds(&f.tyc_id, &f.admin, &withdraw);

        assert_eq!(f.tyc_balance(&f.game_id), game_before - withdraw as i128);
        // Admin's TYC balance increased by the withdrawal
        assert!(f.tyc_balance(&f.admin) >= withdraw as i128);
    }

    /// Three players each receive and redeem their own voucher independently.
    #[test]
    fn three_players_independent_vouchers() {
        let f = Fixture::new();

        let values: [u128; 3] = [
            10_000_000_000_000_000_000,  // 10 TYC
            50_000_000_000_000_000_000,  // 50 TYC
            100_000_000_000_000_000_000, // 100 TYC
        ];
        let players = [&f.player_a, &f.player_b, &f.player_c];

        // Mint vouchers
        let token_ids: Vec<u128> = players
            .iter()
            .zip(values.iter())
            .map(|(player, &value)| f.reward.mint_voucher(&f.admin, player, &value))
            .collect();

        // Redeem in shuffled order (c, a, b)
        f.reward.redeem_voucher_from(&f.player_c, &token_ids[2]);
        f.reward.redeem_voucher_from(&f.player_a, &token_ids[0]);
        f.reward.redeem_voucher_from(&f.player_b, &token_ids[1]);

        // Each player received exactly their voucher value
        assert_eq!(f.tyc_balance(&f.player_a), values[0] as i128);
        assert_eq!(f.tyc_balance(&f.player_b), values[1] as i128);
        assert_eq!(f.tyc_balance(&f.player_c), values[2] as i128);
    }

    /// Cumulative redemptions reduce the reward contract balance correctly.
    #[test]
    fn reward_fund_depletes_correctly() {
        let f = Fixture::new();

        let values: [u128; 3] = [
            10_000_000_000_000_000_000,
            20_000_000_000_000_000_000,
            30_000_000_000_000_000_000,
        ];
        let total: i128 = values.iter().map(|&v| v as i128).sum();

        let tid_a = f.reward.mint_voucher(&f.admin, &f.player_a, &values[0]);
        let tid_b = f.reward.mint_voucher(&f.admin, &f.player_b, &values[1]);
        let tid_c = f.reward.mint_voucher(&f.admin, &f.player_c, &values[2]);

        f.reward.redeem_voucher_from(&f.player_a, &tid_a);
        f.reward.redeem_voucher_from(&f.player_b, &tid_b);
        f.reward.redeem_voucher_from(&f.player_c, &tid_c);

        assert_eq!(f.tyc_balance(&f.reward_id), REWARD_FUND - total);
    }

    /// Both game and reward contracts reference the same TYC token address.
    #[test]
    fn game_and_reward_share_same_token() {
        let f = Fixture::new();

        // Mint a voucher and redeem — TYC comes from reward contract
        let value: u128 = 1_000_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &tid);

        // Withdraw from game — TYC comes from game contract
        let withdraw: u128 = 1_000_000_000_000_000_000_000;
        f.game.withdraw_funds(&f.tyc_id, &f.player_b, &withdraw);

        // Both used the same TYC token — balances are independent
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
        assert_eq!(f.tyc_balance(&f.player_b), withdraw as i128);
    }

    /// Player has zero TYC balance until they redeem their voucher.
    #[test]
    fn player_balance_zero_before_redeem() {
        let f = Fixture::new();

        let value: u128 = 50_000_000_000_000_000_000;
        let _tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        // Voucher minted but not yet redeemed — player has no TYC
        assert_eq!(f.tyc_balance(&f.player_a), 0);
    }

    /// Admin can withdraw from both game and reward contracts independently.
    #[test]
    fn admin_can_withdraw_from_both_contracts() {
        let f = Fixture::new();

        let game_withdraw: u128 = 10_000_000_000_000_000_000_000;
        let reward_withdraw: u128 = 5_000_000_000_000_000_000_000;

        let game_before = f.tyc_balance(&f.game_id);
        let reward_before = f.tyc_balance(&f.reward_id);

        // Withdraw from game
        f.game
            .withdraw_funds(&f.tyc_id, &f.admin, &game_withdraw);

        // Withdraw from reward
        f.reward
            .withdraw_funds(&f.tyc_id, &f.admin, &reward_withdraw);

        assert_eq!(
            f.tyc_balance(&f.game_id),
            game_before - game_withdraw as i128
        );
        assert_eq!(
            f.tyc_balance(&f.reward_id),
            reward_before - reward_withdraw as i128
        );
    }
}
