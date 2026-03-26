/// # Cross-contract flow: Game ↔ Token (#411)
///
/// Exercises the game contract's `withdraw_funds` path which calls the TYC/USDC
/// token contracts, plus collectible info and cash tier round-trips.
///
/// | Test | Cross-contract path |
/// |------|---------------------|
/// | `owner_withdraws_tyc`                  | game.withdraw_funds → TYC transfer |
/// | `owner_withdraws_usdc`                 | game.withdraw_funds → USDC transfer |
/// | `partial_withdrawal_leaves_remainder`  | balance accounting |
/// | `sequential_withdrawals_accumulate`    | multiple withdrawals |
/// | `withdraw_exact_balance_empties_contract` | full balance withdrawal |
/// | `withdraw_exceeds_balance_rejected`    | over-withdrawal panics |
/// | `withdraw_invalid_token_rejected`      | non-allowlisted token panics |
/// | `collectible_info_round_trip`          | set + get collectible info |
/// | `cash_tier_round_trip`                 | set + get cash tier values |
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
        f.game
            .set_collectible_info(&token_id, &7, &3, &500_000_000_000_000_000_000, &10_000_000, &100);
        let info = f.game.get_collectible_info(&token_id);
        assert_eq!(info, (7, 3, 500_000_000_000_000_000_000, 10_000_000, 100));
    }

    #[test]
    fn cash_tier_round_trip() {
        let f = Fixture::new();
        f.game.set_cash_tier_value(&1, &1_000_000_000_000_000_000_000);
        f.game.set_cash_tier_value(&2, &5_000_000_000_000_000_000_000);
        assert_eq!(f.game.get_cash_tier_value(&1), 1_000_000_000_000_000_000_000);
        assert_eq!(f.game.get_cash_tier_value(&2), 5_000_000_000_000_000_000_000);
    }
}
