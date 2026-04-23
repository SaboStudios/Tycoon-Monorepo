/// # Cross-contract flow: Multi-player end-to-end (#411)
///
/// Full session flows involving multiple contracts and multiple players.
///
/// | Test | Cross-contract path |
/// |------|---------------------|
/// | `full_session_register_reward_withdraw` | register → mint voucher → redeem → game withdraw |
/// | `three_players_independent_vouchers`    | three players, shuffled redemption order |
/// | `reward_fund_depletes_correctly`        | cumulative balance accounting |
/// | `game_and_reward_share_same_token`      | both contracts use same TYC address |
/// | `player_balance_zero_before_redeem`     | no pre-transfer on mint |
/// | `admin_withdraws_from_both_contracts`   | independent contract balances |
#[cfg(test)]
mod tests {
    use crate::fixture::{Fixture, GAME_FUND, REWARD_FUND};
    use soroban_sdk::String;

    #[test]
    fn full_session_register_reward_withdraw() {
        let f = Fixture::new();

        // 1. Register player
        f.game
            .register_player(&String::from_str(&f.env, "alice"), &f.player_a);
        assert!(f.game.get_user(&f.player_a).is_some());

        // 2. Mint reward voucher
        let value: u128 = 100_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        // 3. Player redeems — TYC flows from reward contract to player
        let reward_before = f.tyc_balance(&f.reward_id);
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
        assert_eq!(f.tyc_balance(&f.reward_id), reward_before - value as i128);

        // 4. Admin withdraws from game contract
        let withdraw: u128 = 50_000_000_000_000_000_000_000;
        let game_before = f.tyc_balance(&f.game_id);
        f.game.withdraw_funds(&f.tyc_id, &f.admin, &withdraw);
        assert_eq!(f.tyc_balance(&f.game_id), game_before - withdraw as i128);
    }

    #[test]
    fn three_players_independent_vouchers() {
        let f = Fixture::new();
        let values: [u128; 3] = [
            10_000_000_000_000_000_000,
            50_000_000_000_000_000_000,
            100_000_000_000_000_000_000,
        ];
        let players = [&f.player_a, &f.player_b, &f.player_c];

        let tids: [u128; 3] =
            core::array::from_fn(|i| f.reward.mint_voucher(&f.admin, players[i], &values[i]));

        // Redeem in reverse order
        f.reward.redeem_voucher_from(&f.player_c, &tids[2]);
        f.reward.redeem_voucher_from(&f.player_a, &tids[0]);
        f.reward.redeem_voucher_from(&f.player_b, &tids[1]);

        assert_eq!(f.tyc_balance(&f.player_a), values[0] as i128);
        assert_eq!(f.tyc_balance(&f.player_b), values[1] as i128);
        assert_eq!(f.tyc_balance(&f.player_c), values[2] as i128);
    }

    #[test]
    fn reward_fund_depletes_correctly() {
        let f = Fixture::new();
        let values: [u128; 3] = [
            10_000_000_000_000_000_000,
            20_000_000_000_000_000_000,
            30_000_000_000_000_000_000,
        ];
        let total: i128 = values.iter().map(|&v| v as i128).sum();

        let ta = f.reward.mint_voucher(&f.admin, &f.player_a, &values[0]);
        let tb = f.reward.mint_voucher(&f.admin, &f.player_b, &values[1]);
        let tc = f.reward.mint_voucher(&f.admin, &f.player_c, &values[2]);

        f.reward.redeem_voucher_from(&f.player_a, &ta);
        f.reward.redeem_voucher_from(&f.player_b, &tb);
        f.reward.redeem_voucher_from(&f.player_c, &tc);

        assert_eq!(f.tyc_balance(&f.reward_id), REWARD_FUND - total);
    }

    #[test]
    fn game_and_reward_share_same_token() {
        let f = Fixture::new();
        let value: u128 = 1_000_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &tid);

        let withdraw: u128 = 1_000_000_000_000_000_000_000;
        f.game.withdraw_funds(&f.tyc_id, &f.player_b, &withdraw);

        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
        assert_eq!(f.tyc_balance(&f.player_b), withdraw as i128);
    }

    #[test]
    fn player_balance_zero_before_redeem() {
        let f = Fixture::new();
        let value: u128 = 50_000_000_000_000_000_000;
        let _tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        // Voucher minted but not redeemed — player has no TYC yet
        assert_eq!(f.tyc_balance(&f.player_a), 0);
    }

    #[test]
    fn admin_withdraws_from_both_contracts() {
        let f = Fixture::new();
        let gw: u128 = 10_000_000_000_000_000_000_000;
        let rw: u128 = 5_000_000_000_000_000_000_000;

        let game_before = f.tyc_balance(&f.game_id);
        let reward_before = f.tyc_balance(&f.reward_id);

        f.game.withdraw_funds(&f.tyc_id, &f.admin, &gw);
        f.reward.withdraw_funds(&f.tyc_id, &f.admin, &rw);

        assert_eq!(f.tyc_balance(&f.game_id), game_before - gw as i128);
        assert_eq!(f.tyc_balance(&f.reward_id), reward_before - rw as i128);
    }
}
