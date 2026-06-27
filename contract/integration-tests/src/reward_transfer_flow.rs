/// # Cross-contract flow: Reward System — transfer coverage (SW-CT-014)
///
/// Exercises `transfer` in the full cross-contract sandbox where TYC is a real
/// Stellar asset contract. Complements the unit tests in `transfer_tests.rs`.
///
/// | Test | What it pins |
/// |------|--------------|
/// | `transfer_then_redeem_by_receiver`        | receiver redeems a transferred voucher |
/// | `transfer_does_not_move_tyc`              | TYC stays in reward contract until redeem |
/// | `transfer_chain_three_hops`               | A→B→C transfer, C redeems |
/// | `transfer_when_paused_rejected`           | transfer blocked while contract is paused |
/// | `transfer_resumes_after_unpause`          | transfer works again after unpause |
/// | `original_owner_cannot_redeem_after_transfer` | sender loses redemption rights |
/// | `transfer_back_to_original_owner`         | B transfers back to A, A redeems |
/// | `multiple_vouchers_independent_transfers` | two vouchers transferred independently |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::fixture::Fixture;

    /// Voucher transferred to a second player; that player redeems and receives TYC.
    #[test]
    fn transfer_then_redeem_by_receiver() {
        let f = Fixture::new();
        let value: u128 = 50_000_000_000_000_000_000; // 50 TYC

        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 1);

        // player_a transfers to player_b
        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 0);
        assert_eq!(f.reward.get_balance(&f.player_b, &tid), 1);

        // player_b redeems — TYC flows to player_b, not player_a
        f.reward.redeem_voucher_from(&f.player_b, &tid);
        assert_eq!(f.tyc_balance(&f.player_b), value as i128);
        assert_eq!(f.tyc_balance(&f.player_a), 0);
    }

    /// Transferring a voucher does not move TYC — only redemption does.
    #[test]
    fn transfer_does_not_move_tyc() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;

        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        let reward_before = f.tyc_balance(&f.reward_id);

        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);

        // TYC balance of reward contract unchanged after transfer
        assert_eq!(f.tyc_balance(&f.reward_id), reward_before);
        assert_eq!(f.tyc_balance(&f.player_a), 0);
        assert_eq!(f.tyc_balance(&f.player_b), 0);
    }

    /// Three-hop transfer chain: A mints, A→B, B→C, C redeems.
    #[test]
    fn transfer_chain_three_hops() {
        let f = Fixture::new();
        let value: u128 = 100_000_000_000_000_000_000;

        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        f.reward.transfer(&f.player_b, &f.player_c, &tid, &1);

        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 0);
        assert_eq!(f.reward.get_balance(&f.player_b, &tid), 0);
        assert_eq!(f.reward.get_balance(&f.player_c, &tid), 1);

        f.reward.redeem_voucher_from(&f.player_c, &tid);
        assert_eq!(f.tyc_balance(&f.player_c), value as i128);
        assert_eq!(f.tyc_balance(&f.player_a), 0);
        assert_eq!(f.tyc_balance(&f.player_b), 0);
    }

    /// Transfer is rejected while the contract is paused.
    #[test]
    fn transfer_when_paused_rejected() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.pause();

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        }));
        assert!(res.is_err(), "transfer while paused must be rejected");
    }

    /// Transfer resumes after the contract is unpaused.
    #[test]
    fn transfer_resumes_after_unpause() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.pause();
        f.reward.unpause();
        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        assert_eq!(f.reward.get_balance(&f.player_b, &tid), 1);
    }

    /// Original owner cannot redeem after transferring the voucher away.
    #[test]
    fn original_owner_cannot_redeem_after_transfer() {
        let f = Fixture::new();
        let value: u128 = 20_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &tid);
        }));
        assert!(
            res.is_err(),
            "original owner must not redeem after transfer"
        );
    }

    /// Voucher transferred back to original owner; original owner redeems.
    #[test]
    fn transfer_back_to_original_owner() {
        let f = Fixture::new();
        let value: u128 = 30_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        f.reward.transfer(&f.player_b, &f.player_a, &tid, &1);

        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 1);
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
    }

    /// Two vouchers transferred to different players are independent.
    #[test]
    fn multiple_vouchers_independent_transfers() {
        let f = Fixture::new();
        let va: u128 = 10_000_000_000_000_000_000;
        let vb: u128 = 40_000_000_000_000_000_000;

        let ta = f.reward.mint_voucher(&f.admin, &f.player_a, &va);
        let tb = f.reward.mint_voucher(&f.admin, &f.player_b, &vb);

        // Cross-transfer: a→c, b→c
        f.reward.transfer(&f.player_a, &f.player_c, &ta, &1);
        f.reward.transfer(&f.player_b, &f.player_c, &tb, &1);

        assert_eq!(f.reward.get_balance(&f.player_c, &ta), 1);
        assert_eq!(f.reward.get_balance(&f.player_c, &tb), 1);

        f.reward.redeem_voucher_from(&f.player_c, &ta);
        f.reward.redeem_voucher_from(&f.player_c, &tb);

        assert_eq!(f.tyc_balance(&f.player_c), (va + vb) as i128);
        assert_eq!(f.tyc_balance(&f.player_a), 0);
        assert_eq!(f.tyc_balance(&f.player_b), 0);
    }
}
