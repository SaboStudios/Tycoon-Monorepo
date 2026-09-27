/// # Cross-contract flow: Token ↔ Reward System (#411)
///
/// Exercises the path: admin mints voucher → player redeems → TYC transferred
/// from reward contract to player wallet.
///
/// | Test | Cross-contract path |
/// |------|---------------------|
/// | `mint_and_redeem_single_voucher`           | admin → reward.mint_voucher → redeem → TYC transfer |
/// | `backend_minter_can_mint_voucher`          | backend → reward.mint_voucher |
/// | `redeem_transfers_exact_tyc_value`         | table-driven across 5 tiers |
/// | `double_redeem_rejected`                   | second redeem panics |
/// | `redeem_when_paused_rejected`              | paused contract blocks redemption |
/// | `redeem_resumes_after_unpause`             | unpause restores flow |
/// | `reward_contract_balance_decreases`        | balance accounting |
/// | `multiple_vouchers_independent_redemption` | two players, no cross-contamination |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::fixture::Fixture;

    #[test]
    fn mint_and_redeem_single_voucher() {
        let f = Fixture::new();
        let value: u128 = 100_000_000_000_000_000_000; // 100 TYC
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 1);
        assert_eq!(f.tyc_balance(&f.player_a), 0);

        f.reward.redeem_voucher_from(&f.player_a, &tid);

        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 0);
    }

    #[test]
    fn backend_minter_can_mint_voucher() {
        let f = Fixture::new();
        let value: u128 = 50_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.backend, &f.player_b, &value);
        f.reward.redeem_voucher_from(&f.player_b, &tid);
        assert_eq!(f.tyc_balance(&f.player_b), value as i128);
    }

    #[test]
    fn redeem_transfers_exact_tyc_value() {
        let tiers: &[u128] = &[
            1,
            10_000_000_000_000_000_000,
            50_000_000_000_000_000_000,
            100_000_000_000_000_000_000,
            500_000_000_000_000_000_000,
        ];
        for &value in tiers {
            let f = Fixture::new();
            let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
            f.reward.redeem_voucher_from(&f.player_a, &tid);
            assert_eq!(
                f.tyc_balance(&f.player_a),
                value as i128,
                "tier {value}: wrong TYC received"
            );
        }
    }

    #[test]
    fn double_redeem_rejected() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &tid);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &tid);
        }));
        assert!(res.is_err(), "double redeem must be rejected");
    }

    #[test]
    fn redeem_when_paused_rejected() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.pause();

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &tid);
        }));
        assert!(res.is_err(), "redeem while paused must be rejected");
    }

    #[test]
    fn redeem_resumes_after_unpause() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.pause();
        f.reward.unpause();
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
    }

    #[test]
    fn reward_contract_balance_decreases() {
        let f = Fixture::new();
        let value: u128 = 200_000_000_000_000_000_000;
        let before = f.tyc_balance(&f.reward_id);
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.reward_id), before - value as i128);
    }

    #[test]
    fn multiple_vouchers_independent_redemption() {
        let f = Fixture::new();
        let va: u128 = 100_000_000_000_000_000_000;
        let vb: u128 = 250_000_000_000_000_000_000;
        let ta = f.reward.mint_voucher(&f.admin, &f.player_a, &va);
        let tb = f.reward.mint_voucher(&f.admin, &f.player_b, &vb);
        f.reward.redeem_voucher_from(&f.player_b, &tb);
        f.reward.redeem_voucher_from(&f.player_a, &ta);
        assert_eq!(f.tyc_balance(&f.player_a), va as i128);
        assert_eq!(f.tyc_balance(&f.player_b), vb as i128);
    }
}
