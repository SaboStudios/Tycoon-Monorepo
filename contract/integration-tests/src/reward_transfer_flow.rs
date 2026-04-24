/// # Cross-contract flow: Reward System — transfer coverage (SW-CT-014)
///
/// Exercises `transfer` in the full cross-contract sandbox where TYC is a real
/// Stellar asset contract. Complements the unit tests in `transfer_tests.rs`.
///
/// | Test | What it pins |
/// |------|--------------|
/// | `transfer_then_redeem_by_receiver`   | receiver redeems a transferred voucher |
/// | `transfer_does_not_move_tyc`         | TYC stays in reward contract until redeem |
/// | `transfer_chain_three_hops`          | A→B→C transfer, C redeems |
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
}
