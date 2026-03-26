/// # Cross-contract flow: Token ↔ Reward System (#411)
///
/// These tests exercise the path:
///   admin mints voucher → player redeems voucher → TYC transferred from reward contract
///
/// ## Paths covered
///
/// | Test | Path |
/// |------|------|
/// | `mint_and_redeem_single_voucher` | Happy path: mint → redeem → TYC lands in player wallet |
/// | `backend_minter_can_mint_voucher` | Backend minter (not admin) mints a voucher |
/// | `redeem_transfers_exact_tyc_value` | Exact value invariant across multiple tiers |
/// | `double_redeem_rejected` | Voucher cannot be redeemed twice |
/// | `redeem_when_paused_rejected` | Paused contract blocks redemption |
/// | `redeem_resumes_after_unpause` | Unpause restores redemption |
/// | `reward_contract_balance_decreases_on_redeem` | Contract balance accounting |
/// | `multiple_vouchers_independent_redemption` | Two players redeem independently |
#[cfg(test)]
mod tests {
    use crate::fixture::Fixture;

    /// Happy path: admin mints a voucher, player redeems it, TYC arrives.
    #[test]
    fn mint_and_redeem_single_voucher() {
        let f = Fixture::new();

        let value: u128 = 100_000_000_000_000_000_000; // 100 TYC
        let token_id = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        assert_eq!(f.reward.get_balance(&f.player_a, &token_id), 1);
        assert_eq!(f.tyc_balance(&f.player_a), 0);

        f.reward.redeem_voucher_from(&f.player_a, &token_id);

        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
        assert_eq!(f.reward.get_balance(&f.player_a, &token_id), 0);
    }

    /// Backend minter (not admin) can mint a voucher.
    #[test]
    fn backend_minter_can_mint_voucher() {
        let f = Fixture::new();

        let value: u128 = 50_000_000_000_000_000_000; // 50 TYC
        let token_id = f.reward.mint_voucher(&f.backend, &f.player_b, &value);

        assert_eq!(f.reward.get_balance(&f.player_b, &token_id), 1);

        f.reward.redeem_voucher_from(&f.player_b, &token_id);
        assert_eq!(f.tyc_balance(&f.player_b), value as i128);
    }

    /// Table-driven: exact TYC value is preserved across all tiers.
    #[test]
    fn redeem_transfers_exact_tyc_value() {
        let tiers: &[u128] = &[
            1,                                    // 1 raw unit
            10_000_000_000_000_000_000,           // 10 TYC
            50_000_000_000_000_000_000,           // 50 TYC
            100_000_000_000_000_000_000,          // 100 TYC
            500_000_000_000_000_000_000,          // 500 TYC
        ];

        for &value in tiers {
            let f = Fixture::new();
            let token_id = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
            f.reward.redeem_voucher_from(&f.player_a, &token_id);
            assert_eq!(
                f.tyc_balance(&f.player_a),
                value as i128,
                "tier {value}: wrong TYC received"
            );
        }
    }

    /// Voucher cannot be redeemed twice — second attempt panics.
    #[test]
    fn double_redeem_rejected() {
        extern crate std;
        let f = Fixture::new();

        let value: u128 = 10_000_000_000_000_000_000;
        let token_id = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &token_id);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &token_id);
        }));
        assert!(res.is_err(), "double redeem must be rejected");
    }

    /// Paused contract blocks redemption.
    #[test]
    fn redeem_when_paused_rejected() {
        extern crate std;
        let f = Fixture::new();

        let value: u128 = 10_000_000_000_000_000_000;
        let token_id = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        f.reward.pause();

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &token_id);
        }));
        assert!(res.is_err(), "redeem while paused must be rejected");
    }

    /// Unpause restores redemption.
    #[test]
    fn redeem_resumes_after_unpause() {
        let f = Fixture::new();

        let value: u128 = 10_000_000_000_000_000_000;
        let token_id = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        f.reward.pause();
        f.reward.unpause();

        f.reward.redeem_voucher_from(&f.player_a, &token_id);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
    }

    /// Reward contract TYC balance decreases by exactly the voucher value on redeem.
    #[test]
    fn reward_contract_balance_decreases_on_redeem() {
        let f = Fixture::new();

        let value: u128 = 200_000_000_000_000_000_000; // 200 TYC
        let before = f.tyc_balance(&f.reward_id);

        let token_id = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &token_id);

        assert_eq!(f.tyc_balance(&f.reward_id), before - value as i128);
    }

    /// Two players each hold a voucher and redeem independently — no cross-contamination.
    #[test]
    fn multiple_vouchers_independent_redemption() {
        let f = Fixture::new();

        let value_a: u128 = 100_000_000_000_000_000_000; // 100 TYC
        let value_b: u128 = 250_000_000_000_000_000_000; // 250 TYC

        let tid_a = f.reward.mint_voucher(&f.admin, &f.player_a, &value_a);
        let tid_b = f.reward.mint_voucher(&f.admin, &f.player_b, &value_b);

        // Redeem in reverse order
        f.reward.redeem_voucher_from(&f.player_b, &tid_b);
        f.reward.redeem_voucher_from(&f.player_a, &tid_a);

        assert_eq!(f.tyc_balance(&f.player_a), value_a as i128);
        assert_eq!(f.tyc_balance(&f.player_b), value_b as i128);
    }
}
