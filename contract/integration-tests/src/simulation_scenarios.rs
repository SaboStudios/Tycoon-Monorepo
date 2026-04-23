/// # Cross-contract simulation scenarios (SW-FE-001)
///
/// End-to-end scenarios that exercise realistic game-session flows across
/// the reward and game contracts in a single isolated Soroban sandbox.
///
/// Scenarios that overlap with `multi_player_flow` (shuffled redemption,
/// independent admin withdrawals) live there. This module covers flows
/// unique to simulation-style testing: pause/unpause, controller rotation,
/// depletion guards, double-redeem rejection, zero-withdraw guard, event
/// emission, and reward-tier precision.
///
/// | ID    | Scenario |
/// |-------|----------|
/// | SIM-A | Full session: register → backend mints voucher → redeem → game withdraw |
/// | SIM-B | Pause mid-session: voucher minted, contract paused, redeem blocked, unpause restores |
/// | SIM-C | Backend controller rotation mid-session |
/// | SIM-D | Reward fund depletion guard: redeem fails when contract is underfunded |
/// | SIM-E | Double-redeem rejected: second redeem of the same voucher panics |
/// | SIM-F | Zero-amount withdraw is a no-op at integration level |
/// | SIM-G | Player registers, backend removes from game, events emitted |
/// | SIM-H | Table-driven: five reward tiers all transfer exact TYC amounts |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::fixture::{Fixture, GAME_FUND, REWARD_FUND};
    use soroban_sdk::{
        testutils::Address as _,
        Address, String,
    };

    // ── SIM-A ─────────────────────────────────────────────────────────────────

    /// SIM-A: Full session — register player, backend mints voucher, player redeems,
    /// admin withdraws from game contract.
    #[test]
    fn sim_a_full_session_register_reward_withdraw() {
        let f = Fixture::new();

        f.game
            .register_player(&String::from_str(&f.env, "alice"), &f.player_a);
        assert!(f.game.get_user(&f.player_a).is_some());

        let value: u128 = 100_000_000_000_000_000_000; // 100 TYC
        let tid = f.reward.mint_voucher(&f.backend, &f.player_a, &value);
        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 1);
        assert_eq!(f.tyc_balance(&f.player_a), 0);

        let reward_before = f.tyc_balance(&f.reward_id);
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
        assert_eq!(f.tyc_balance(&f.reward_id), reward_before - value as i128);

        let withdraw: u128 = 50_000_000_000_000_000_000_000;
        let game_before = f.tyc_balance(&f.game_id);
        f.game.withdraw_funds(&f.tyc_id, &f.admin, &withdraw);
        assert_eq!(f.tyc_balance(&f.game_id), game_before - withdraw as i128);
    }

    // ── SIM-B ─────────────────────────────────────────────────────────────────

    /// SIM-B: Pause mid-session — voucher minted, contract paused, redeem blocked,
    /// unpause restores flow.
    #[test]
    fn sim_b_pause_mid_session_blocks_then_restores_redeem() {
        let f = Fixture::new();
        let value: u128 = 50_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        f.reward.pause();

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &tid);
        }));
        assert!(res.is_err(), "SIM-B: redeem while paused must be rejected");

        f.reward.unpause();
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
    }

    // ── SIM-C ─────────────────────────────────────────────────────────────────

    /// SIM-C: Backend controller rotation mid-session — old controller loses game access.
    #[test]
    fn sim_c_backend_controller_rotation_mid_session() {
        let f = Fixture::new();
        let new_backend = Address::generate(&f.env);
        let player = f.player_a.clone();

        f.game.remove_player_from_game(&f.backend, &1, &player, &5);

        f.game.set_backend_game_controller(&new_backend);
        f.game.remove_player_from_game(&new_backend, &2, &player, &10);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.remove_player_from_game(&f.backend, &3, &player, &1);
        }));
        assert!(res.is_err(), "SIM-C: old backend should be rejected after rotation");
    }

    // ── SIM-D ─────────────────────────────────────────────────────────────────

    /// SIM-D: Reward fund depletion guard — redeem fails when contract is underfunded.
    #[test]
    fn sim_d_redeem_fails_when_reward_contract_underfunded() {
        let f = Fixture::new();

        // Drain the reward contract completely
        f.reward.withdraw_funds(&f.tyc_id, &f.admin, &(REWARD_FUND as u128));
        assert_eq!(f.tyc_balance(&f.reward_id), 0);

        // Mint a voucher — this succeeds (no TYC transferred yet)
        let value: u128 = 1_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        // Redeem must fail — contract has no TYC to transfer
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &tid);
        }));
        assert!(res.is_err(), "SIM-D: redeem should fail when contract is underfunded");
    }

    // ── SIM-E ─────────────────────────────────────────────────────────────────

    /// SIM-E: Double-redeem rejected — a voucher cannot be redeemed twice.
    ///
    /// The first redeem burns the voucher balance to zero; the second must panic
    /// rather than silently transferring zero TYC.
    #[test]
    fn sim_e_double_redeem_rejected() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);

        // First redeem succeeds
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);

        // Second redeem must be rejected
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.redeem_voucher_from(&f.player_a, &tid);
        }));
        assert!(res.is_err(), "SIM-E: second redeem of same voucher must be rejected");
    }

    // ── SIM-F ─────────────────────────────────────────────────────────────────

    /// SIM-F: Zero-amount withdraw is a no-op at integration level.
    ///
    /// Calling `withdraw_funds` with amount=0 must leave both the contract
    /// balance and the recipient balance unchanged.
    #[test]
    fn sim_f_zero_withdraw_is_noop_integration() {
        let f = Fixture::new();
        let before = f.tyc_balance(&f.game_id);

        f.game.withdraw_funds(&f.tyc_id, &f.player_a, &0);

        assert_eq!(
            f.tyc_balance(&f.game_id),
            before,
            "SIM-F: game contract balance must not change on zero withdraw"
        );
        assert_eq!(
            f.tyc_balance(&f.player_a),
            0,
            "SIM-F: recipient must receive nothing on zero withdraw"
        );
    }

    // ── SIM-G ─────────────────────────────────────────────────────────────────

    /// SIM-G: Player registers, backend removes from game, events are emitted.
    #[test]
    fn sim_g_register_then_backend_removes_emits_events() {
        let f = Fixture::new();
        f.game
            .register_player(&String::from_str(&f.env, "grace"), &f.player_a);
        assert!(f.game.get_user(&f.player_a).is_some());

        f.game
            .remove_player_from_game(&f.backend, &99, &f.player_a, &42);

        assert!(!f.env.events().all().is_empty());
    }

    // ── SIM-H ─────────────────────────────────────────────────────────────────

    /// SIM-H: Table-driven — five reward tiers all transfer exact TYC amounts.
    #[test]
    fn sim_h_reward_tiers_transfer_exact_amounts() {
        let tiers: &[(&str, u128)] = &[
            ("1-unit",    1),
            ("bronze",    10_000_000_000_000_000_000),
            ("silver",    50_000_000_000_000_000_000),
            ("gold",     100_000_000_000_000_000_000),
            ("platinum", 500_000_000_000_000_000_000),
        ];

        for (name, value) in tiers {
            let f = Fixture::new();
            let tid = f.reward.mint_voucher(&f.admin, &f.player_a, value);
            f.reward.redeem_voucher_from(&f.player_a, &tid);
            assert_eq!(
                f.tyc_balance(&f.player_a),
                *value as i128,
                "SIM-H tier {name}: wrong TYC received"
            );
        }
    }
}
