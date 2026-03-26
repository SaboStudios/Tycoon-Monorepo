/// # Cross-contract flow: Game ↔ Token (#411)
///
/// These tests exercise the path where the game contract transfers TYC/USDC
/// tokens via `withdraw_funds`, validating the token allowlist and balance guards.
///
/// ## Paths covered
///
/// | Test | Path |
/// |------|------|
/// | `owner_withdraws_tyc` | Owner withdraws TYC from game contract |
/// | `owner_withdraws_usdc` | Owner withdraws USDC from game contract |
/// | `partial_withdrawal_leaves_remainder` | Partial withdrawal; remainder stays in contract |
/// | `sequential_withdrawals_accumulate` | Multiple withdrawals reduce balance correctly |
/// | `withdraw_exact_balance_empties_contract` | Withdraw full balance → contract at zero |
/// | `withdraw_exceeds_balance_rejected` | Over-withdrawal panics |
/// | `withdraw_invalid_token_rejected` | Non-allowlisted token panics |
/// | `collectible_info_round_trip` | Set and get collectible info via game contract |
/// | `cash_tier_round_trip` | Set and get cash tier values |
#[cfg(test)]
mod tests {
    use crate::fixture::{Fixture, GAME_FUND};
    use soroban_sdk::{
        testutils::Address as _,
        token::StellarAssetClient,
    };

    /// Owner withdraws TYC — recipient receives exact amount.
    #[test]
    fn owner_withdraws_tyc() {
        let f = Fixture::new();
        let recipient = soroban_sdk::Address::generate(&f.env);
        let amount: u128 = 1_000_000_000_000_000_000_000; // 1 000 TYC

        f.game.withdraw_funds(&f.tyc_id, &recipient, &amount);

        assert_eq!(f.tyc_balance(&recipient), amount as i128);
        assert_eq!(f.tyc_balance(&f.game_id), GAME_FUND - amount as i128);
    }

    /// Owner withdraws USDC — recipient receives exact amount.
    #[test]
    fn owner_withdraws_usdc() {
        let f = Fixture::new();
        let recipient = soroban_sdk::Address::generate(&f.env);
        let usdc_fund: i128 = 10_000_000; // 10 USDC (6 decimals)
        let withdraw: u128 = 5_000_000;

        // Fund game contract with USDC
        StellarAssetClient::new(&f.env, &f.usdc_id).mint(&f.game_id, &usdc_fund);

        f.game.withdraw_funds(&f.usdc_id, &recipient, &withdraw);

        let usdc = soroban_sdk::token::Client::new(&f.env, &f.usdc_id);
        assert_eq!(usdc.balance(&recipient), withdraw as i128);
        assert_eq!(usdc.balance(&f.game_id), usdc_fund - withdraw as i128);
    }

    /// Partial withdrawal leaves the correct remainder in the contract.
    #[test]
    fn partial_withdrawal_leaves_remainder() {
        let f = Fixture::new();
        let recipient = soroban_sdk::Address::generate(&f.env);
        let withdraw: u128 = 100_000_000_000_000_000_000_000; // 100 000 TYC

        f.game.withdraw_funds(&f.tyc_id, &recipient, &withdraw);

        assert_eq!(f.tyc_balance(&f.game_id), GAME_FUND - withdraw as i128);
    }

    /// Sequential withdrawals reduce the contract balance correctly.
    #[test]
    fn sequential_withdrawals_accumulate() {
        let f = Fixture::new();
        let recipient = soroban_sdk::Address::generate(&f.env);

        let amounts: &[u128] = &[
            10_000_000_000_000_000_000_000,
            20_000_000_000_000_000_000_000,
            30_000_000_000_000_000_000_000,
        ];
        let total: i128 = amounts.iter().map(|&a| a as i128).sum();

        for &amount in amounts {
            f.game.withdraw_funds(&f.tyc_id, &recipient, &amount);
        }

        assert_eq!(f.tyc_balance(&recipient), total);
        assert_eq!(f.tyc_balance(&f.game_id), GAME_FUND - total);
    }

    /// Withdrawing the exact full balance empties the contract.
    #[test]
    fn withdraw_exact_balance_empties_contract() {
        let f = Fixture::new();
        let recipient = soroban_sdk::Address::generate(&f.env);

        f.game
            .withdraw_funds(&f.tyc_id, &recipient, &(GAME_FUND as u128));

        assert_eq!(f.tyc_balance(&f.game_id), 0);
        assert_eq!(f.tyc_balance(&recipient), GAME_FUND);
    }

    /// Withdrawing more than the balance panics.
    #[test]
    fn withdraw_exceeds_balance_rejected() {
        extern crate std;
        let f = Fixture::new();
        let recipient = soroban_sdk::Address::generate(&f.env);
        let over = (GAME_FUND + 1) as u128;

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.withdraw_funds(&f.tyc_id, &recipient, &over);
        }));
        assert!(res.is_err(), "over-withdrawal must be rejected");
    }

    /// Withdrawing a token not in the allowlist panics.
    #[test]
    fn withdraw_invalid_token_rejected() {
        extern crate std;
        let f = Fixture::new();
        let recipient = soroban_sdk::Address::generate(&f.env);
        let rogue_admin = soroban_sdk::Address::generate(&f.env);
        let rogue_token = f
            .env
            .register_stellar_asset_contract_v2(rogue_admin)
            .address();

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.withdraw_funds(&rogue_token, &recipient, &1);
        }));
        assert!(res.is_err(), "invalid token withdrawal must be rejected");
    }

    /// Collectible info round-trip: set then get returns the same values.
    #[test]
    fn collectible_info_round_trip() {
        let f = Fixture::new();

        let token_id: u128 = 42;
        let perk: u32 = 7;
        let strength: u32 = 3;
        let tyc_price: u128 = 500_000_000_000_000_000_000;
        let usdc_price: u128 = 10_000_000;
        let shop_stock: u64 = 100;

        f.game.set_collectible_info(
            &token_id,
            &perk,
            &strength,
            &tyc_price,
            &usdc_price,
            &shop_stock,
        );

        let info = f.game.get_collectible_info(&token_id);
        assert_eq!(info, (perk, strength, tyc_price, usdc_price, shop_stock));
    }

    /// Cash tier round-trip: set then get returns the same value.
    #[test]
    fn cash_tier_round_trip() {
        let f = Fixture::new();

        f.game.set_cash_tier_value(&1, &1_000_000_000_000_000_000_000);
        f.game.set_cash_tier_value(&2, &5_000_000_000_000_000_000_000);
        f.game.set_cash_tier_value(&3, &10_000_000_000_000_000_000_000);

        assert_eq!(f.game.get_cash_tier_value(&1), 1_000_000_000_000_000_000_000);
        assert_eq!(f.game.get_cash_tier_value(&2), 5_000_000_000_000_000_000_000);
        assert_eq!(f.game.get_cash_tier_value(&3), 10_000_000_000_000_000_000_000);
    }
}
