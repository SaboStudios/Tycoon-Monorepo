/// # Cross-contract flow: Game ↔ Token (#411)
///
/// Exercises the game contract's `withdraw_funds` path which calls the TYC/USDC
/// token contracts, plus collectible info and cash tier round-trips.
///
/// | Test | Cross-contract path |
/// |------|---------------------|
/// | `owner_withdraws_tyc`                     | game.withdraw_funds → TYC transfer |
/// | `owner_withdraws_usdc`                    | game.withdraw_funds → USDC transfer |
/// | `partial_withdrawal_leaves_remainder`     | balance accounting |
/// | `sequential_withdrawals_accumulate`       | multiple withdrawals |
/// | `withdraw_exact_balance_empties_contract` | full balance withdrawal |
/// | `withdraw_exceeds_balance_rejected`       | over-withdrawal panics |
/// | `withdraw_invalid_token_rejected`         | non-allowlisted token panics |
/// | `collectible_info_round_trip`             | set + get collectible info |
/// | `cash_tier_round_trip`                    | set + get cash tier values |
/// | `withdraw_zero_amount_is_noop`            | zero-amount withdrawal is a no-op |
/// | `withdraw_to_multiple_recipients`         | independent recipient balances |
/// | `game_balance_unaffected_by_reward_ops`   | reward redemption does not touch game funds |
/// | `collectible_info_overwrite`              | second set_collectible_info overwrites first |
/// | `cash_tier_overwrite`                     | second set_cash_tier_value overwrites first |
/// | `cash_tier_zero_value`                    | tier value of 0 is stored and returned |
/// | `withdraw_tyc_then_usdc_independent`      | TYC and USDC balances tracked separately |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::fixture::{Fixture, GAME_FUND};
    use soroban_sdk::{testutils::Address as _, token::StellarAssetClient, Address};

    #[test]
    fn owner_withdraws_tyc() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let amount: u128 = 1_000_000_000_000_000_000_000;
        f.game.withdraw_funds(&f.tyc_id, &recipient, &amount);
        assert_eq!(f.tyc_balance(&recipient), amount as i128);
        assert_eq!(f.tyc_balance(&f.game_id), GAME_FUND - amount as i128);
    }

    #[test]
    fn owner_withdraws_usdc() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let usdc_fund: i128 = 10_000_000;
        let withdraw: u128 = 5_000_000;
        StellarAssetClient::new(&f.env, &f.usdc_id).mint(&f.game_id, &usdc_fund);
        f.game.withdraw_funds(&f.usdc_id, &recipient, &withdraw);
        let usdc = soroban_sdk::token::Client::new(&f.env, &f.usdc_id);
        assert_eq!(usdc.balance(&recipient), withdraw as i128);
        assert_eq!(usdc.balance(&f.game_id), usdc_fund - withdraw as i128);
    }

    #[test]
    fn partial_withdrawal_leaves_remainder() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let withdraw: u128 = 100_000_000_000_000_000_000_000;
        f.game.withdraw_funds(&f.tyc_id, &recipient, &withdraw);
        assert_eq!(f.tyc_balance(&f.game_id), GAME_FUND - withdraw as i128);
    }

    #[test]
    fn sequential_withdrawals_accumulate() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let amounts: &[u128] = &[
            10_000_000_000_000_000_000_000,
            20_000_000_000_000_000_000_000,
            30_000_000_000_000_000_000_000,
        ];
        let total: i128 = amounts.iter().map(|&a| a as i128).sum();
        for &a in amounts {
            f.game.withdraw_funds(&f.tyc_id, &recipient, &a);
        }
        assert_eq!(f.tyc_balance(&recipient), total);
        assert_eq!(f.tyc_balance(&f.game_id), GAME_FUND - total);
    }

    #[test]
    fn withdraw_exact_balance_empties_contract() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        f.game
            .withdraw_funds(&f.tyc_id, &recipient, &(GAME_FUND as u128));
        assert_eq!(f.tyc_balance(&f.game_id), 0);
        assert_eq!(f.tyc_balance(&recipient), GAME_FUND);
    }

    #[test]
    fn withdraw_exceeds_balance_rejected() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game
                .withdraw_funds(&f.tyc_id, &recipient, &(GAME_FUND as u128 + 1));
        }));
        assert!(res.is_err());
    }

    #[test]
    fn withdraw_invalid_token_rejected() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let rogue = f
            .env
            .register_stellar_asset_contract_v2(Address::generate(&f.env))
            .address();
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.withdraw_funds(&rogue, &recipient, &1);
        }));
        assert!(res.is_err());
    }

    #[test]
    fn collectible_info_round_trip() {
        let f = Fixture::new();
        let token_id: u128 = 42;
        f.game.set_collectible_info(
            &token_id,
            &7,
            &3,
            &500_000_000_000_000_000_000,
            &10_000_000,
            &100,
        );
        let info = f.game.get_collectible_info(&token_id);
        assert_eq!(info, (7, 3, 500_000_000_000_000_000_000, 10_000_000, 100));
    }

    #[test]
    fn cash_tier_round_trip() {
        let f = Fixture::new();
        f.game
            .set_cash_tier_value(&1, &1_000_000_000_000_000_000_000);
        f.game
            .set_cash_tier_value(&2, &5_000_000_000_000_000_000_000);
        f.game
            .set_cash_tier_value(&3, &10_000_000_000_000_000_000_000);
        assert_eq!(
            f.game.get_cash_tier_value(&1),
            1_000_000_000_000_000_000_000
        );
        assert_eq!(
            f.game.get_cash_tier_value(&2),
            5_000_000_000_000_000_000_000
        );
        assert_eq!(
            f.game.get_cash_tier_value(&3),
            10_000_000_000_000_000_000_000
        );
    }

    // ── Expanded scenarios ────────────────────────────────────────────────────

    /// Zero-amount withdrawal is a no-op: balances unchanged.
    #[test]
    fn withdraw_zero_amount_is_noop() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let before = f.tyc_balance(&f.game_id);
        f.game.withdraw_funds(&f.tyc_id, &recipient, &0);
        assert_eq!(f.tyc_balance(&f.game_id), before);
        assert_eq!(f.tyc_balance(&recipient), 0);
    }

    /// Withdrawals to different recipients are tracked independently.
    #[test]
    fn withdraw_to_multiple_recipients() {
        let f = Fixture::new();
        let r1 = Address::generate(&f.env);
        let r2 = Address::generate(&f.env);
        let r3 = Address::generate(&f.env);
        let a1: u128 = 10_000_000_000_000_000_000_000;
        let a2: u128 = 20_000_000_000_000_000_000_000;
        let a3: u128 = 30_000_000_000_000_000_000_000;
        f.game.withdraw_funds(&f.tyc_id, &r1, &a1);
        f.game.withdraw_funds(&f.tyc_id, &r2, &a2);
        f.game.withdraw_funds(&f.tyc_id, &r3, &a3);
        assert_eq!(f.tyc_balance(&r1), a1 as i128);
        assert_eq!(f.tyc_balance(&r2), a2 as i128);
        assert_eq!(f.tyc_balance(&r3), a3 as i128);
        assert_eq!(
            f.tyc_balance(&f.game_id),
            GAME_FUND - (a1 + a2 + a3) as i128
        );
    }

    /// Reward contract redemptions do not affect game contract TYC balance.
    #[test]
    fn game_balance_unaffected_by_reward_ops() {
        let f = Fixture::new();
        let game_before = f.tyc_balance(&f.game_id);
        let value: u128 = 100_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.game_id), game_before);
    }

    /// A second `set_collectible_info` call overwrites the first.
    #[test]
    fn collectible_info_overwrite() {
        let f = Fixture::new();
        let token_id: u128 = 99;
        f.game.set_collectible_info(
            &token_id,
            &1,
            &1,
            &100_000_000_000_000_000_000,
            &1_000_000,
            &10,
        );
        f.game.set_collectible_info(
            &token_id,
            &5,
            &2,
            &999_000_000_000_000_000_000,
            &9_000_000,
            &50,
        );
        let info = f.game.get_collectible_info(&token_id);
        assert_eq!(info, (5, 2, 999_000_000_000_000_000_000, 9_000_000, 50));
    }

    /// A second `set_cash_tier_value` call overwrites the first.
    #[test]
    fn cash_tier_overwrite() {
        let f = Fixture::new();
        f.game
            .set_cash_tier_value(&10, &1_000_000_000_000_000_000_000);
        f.game
            .set_cash_tier_value(&10, &9_999_000_000_000_000_000_000);
        assert_eq!(
            f.game.get_cash_tier_value(&10),
            9_999_000_000_000_000_000_000
        );
    }

    /// A cash tier value of 0 is stored and returned correctly.
    #[test]
    fn cash_tier_zero_value() {
        let f = Fixture::new();
        f.game.set_cash_tier_value(&20, &0);
        assert_eq!(f.game.get_cash_tier_value(&20), 0);
    }

    /// TYC and USDC withdrawals are tracked in separate ledger entries.
    #[test]
    fn withdraw_tyc_then_usdc_independent() {
        let f = Fixture::new();
        let recipient = Address::generate(&f.env);
        let usdc_fund: i128 = 10_000_000;
        let usdc_withdraw: u128 = 3_000_000;
        let tyc_withdraw: u128 = 50_000_000_000_000_000_000_000;
        StellarAssetClient::new(&f.env, &f.usdc_id).mint(&f.game_id, &usdc_fund);
        f.game.withdraw_funds(&f.tyc_id, &recipient, &tyc_withdraw);
        f.game
            .withdraw_funds(&f.usdc_id, &recipient, &usdc_withdraw);
        assert_eq!(f.tyc_balance(&recipient), tyc_withdraw as i128);
        let usdc = soroban_sdk::token::Client::new(&f.env, &f.usdc_id);
        assert_eq!(usdc.balance(&recipient), usdc_withdraw as i128);
    }
}
