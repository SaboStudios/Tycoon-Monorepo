/// # Simulation scenarios — Stellar Wave (SW-FE-001)
///
/// End-to-end simulation scenarios that exercise realistic on-chain behaviour
/// across the full contract suite.  Each scenario models a distinct user or
/// operator journey; no shared state between tests (every test creates its own
/// `Fixture`).
///
/// | Scenario | Description |
/// |----------|-------------|
/// | `voucher_transfer_then_redeem`              | Player A receives voucher, transfers to B, B redeems |
/// | `backend_minter_lifecycle`                  | set → mint → clear → mint rejected |
/// | `owned_token_count_tracks_mint_transfer_redeem` | count invariant across full lifecycle |
/// | `game_export_state_reflects_live_config`    | export_state snapshot matches initialised values |
/// | `reward_transfer_blocked_when_paused`       | transfer rejected while contract is paused |
/// | `game_migrate_is_idempotent`                | migrate on v1 is a no-op (no panic, version unchanged) |
/// | `sequential_voucher_ids_are_unique`         | each mint_voucher returns a distinct token_id |
/// | `reward_fund_survives_partial_redemptions`  | partial redemptions leave correct residual balance |
/// | `multi_voucher_batch_then_bulk_redeem`      | three vouchers minted in batch, redeemed out-of-order |
/// | `game_collectible_update_overwrites`        | set_collectible_info twice, second write wins |
/// | `cash_tier_independent_slots`              | multiple tiers stored and retrieved independently |
/// | `player_data_persists_after_game_removal`   | remove_player_from_game is session-scoped; user record survives |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::fixture::{Fixture, REWARD_FUND};
    use soroban_sdk::{testutils::Address as _, Address, String};

    // -------------------------------------------------------------------------
    // Scenario 1: Voucher transfer then redeem
    //
    // Player A is awarded a voucher.  Before redeeming, A transfers it to B.
    // B redeems and receives the TYC; A ends up with nothing.
    // -------------------------------------------------------------------------
    #[test]
    fn voucher_transfer_then_redeem() {
        let f = Fixture::new();
        let value: u128 = 75_000_000_000_000_000_000; // 75 TYC

        // Admin mints voucher for player_a
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 1);
        assert_eq!(f.reward.get_balance(&f.player_b, &tid), 0);

        // player_a transfers the voucher to player_b
        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 0);
        assert_eq!(f.reward.get_balance(&f.player_b, &tid), 1);

        // player_b redeems — TYC flows from reward contract to player_b
        let reward_before = f.tyc_balance(&f.reward_id);
        f.reward.redeem_voucher_from(&f.player_b, &tid);

        assert_eq!(f.tyc_balance(&f.player_b), value as i128);
        assert_eq!(f.tyc_balance(&f.player_a), 0);
        assert_eq!(f.tyc_balance(&f.reward_id), reward_before - value as i128);
    }

    // -------------------------------------------------------------------------
    // Scenario 2: Backend minter lifecycle
    //
    // Admin sets a backend minter, the minter mints a voucher, admin clears the
    // minter, and a subsequent mint attempt by the (now-revoked) minter panics.
    // -------------------------------------------------------------------------
    #[test]
    fn backend_minter_lifecycle() {
        let f = Fixture::new();
        let new_minter = Address::generate(&f.env);
        let value: u128 = 10_000_000_000_000_000_000;

        // Set a fresh backend minter
        f.reward.set_backend_minter(&f.admin, &new_minter);
        assert_eq!(f.reward.get_backend_minter(), Some(new_minter.clone()));

        // New minter can mint
        let tid = f.reward.mint_voucher(&new_minter, &f.player_a, &value);
        assert_eq!(f.reward.get_balance(&f.player_a, &tid), 1);

        // Admin clears the minter
        f.reward.clear_backend_minter(&f.admin);
        assert_eq!(f.reward.get_backend_minter(), None);

        // Revoked minter can no longer mint
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.mint_voucher(&new_minter, &f.player_b, &value);
        }));
        assert!(res.is_err(), "revoked minter must be rejected");
    }

    // -------------------------------------------------------------------------
    // Scenario 3: owned_token_count invariant across mint → transfer → redeem
    //
    // Verifies that the count tracks correctly at every state transition.
    // -------------------------------------------------------------------------
    #[test]
    fn owned_token_count_tracks_mint_transfer_redeem() {
        let f = Fixture::new();
        let value: u128 = 20_000_000_000_000_000_000;

        assert_eq!(f.reward.owned_token_count(&f.player_a), 0);
        assert_eq!(f.reward.owned_token_count(&f.player_b), 0);

        // Mint two vouchers for player_a
        let t1 = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        let t2 = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        assert_eq!(f.reward.owned_token_count(&f.player_a), 2);

        // Transfer t1 to player_b
        f.reward.transfer(&f.player_a, &f.player_b, &t1, &1);
        assert_eq!(f.reward.owned_token_count(&f.player_a), 1);
        assert_eq!(f.reward.owned_token_count(&f.player_b), 1);

        // player_b redeems t1
        f.reward.redeem_voucher_from(&f.player_b, &t1);
        assert_eq!(f.reward.owned_token_count(&f.player_b), 0);

        // player_a redeems t2
        f.reward.redeem_voucher_from(&f.player_a, &t2);
        assert_eq!(f.reward.owned_token_count(&f.player_a), 0);
    }

    // -------------------------------------------------------------------------
    // Scenario 4: export_state snapshot reflects live configuration
    //
    // After initialisation the snapshot must match the addresses and flags set
    // during Fixture::new().
    // -------------------------------------------------------------------------
    #[test]
    fn game_export_state_reflects_live_config() {
        let f = Fixture::new();
        let snap = f.game.export_state();

        assert_eq!(snap.owner, f.admin);
        assert_eq!(snap.tyc_token, f.tyc_id);
        assert_eq!(snap.usdc_token, f.usdc_id);
        assert_eq!(snap.reward_system, f.reward_id);
        assert!(snap.is_initialized);
        assert_eq!(snap.state_version, 1);
        // backend_controller was set in Fixture::new via set_backend_game_controller
        assert_eq!(snap.backend_controller, Some(f.backend.clone()));
    }

    // -------------------------------------------------------------------------
    // Scenario 5: Voucher transfer blocked when contract is paused
    //
    // Pausing must block transfers as well as redemptions.
    // -------------------------------------------------------------------------
    #[test]
    fn reward_transfer_blocked_when_paused() {
        let f = Fixture::new();
        let value: u128 = 10_000_000_000_000_000_000;

        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.pause();

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        }));
        assert!(res.is_err(), "transfer while paused must be rejected");

        // Unpause and verify transfer now succeeds
        f.reward.unpause();
        f.reward.transfer(&f.player_a, &f.player_b, &tid, &1);
        assert_eq!(f.reward.get_balance(&f.player_b, &tid), 1);
    }

    // -------------------------------------------------------------------------
    // Scenario 6: game.migrate is idempotent on v1
    //
    // Calling migrate on an already-v1 contract must not panic and must leave
    // the state_version unchanged.
    // -------------------------------------------------------------------------
    #[test]
    fn game_migrate_is_idempotent() {
        let f = Fixture::new();

        // Pre-condition: state_version == 1 after initialisation
        let before = f.game.export_state();
        assert_eq!(before.state_version, 1);

        // migrate() on v1 is a documented no-op — must not panic
        f.game.migrate();

        let after = f.game.export_state();
        assert_eq!(after.state_version, 1, "migrate on v1 must not bump version");
    }

    // -------------------------------------------------------------------------
    // Scenario 7: Sequential voucher IDs are unique
    //
    // Each call to mint_voucher must return a strictly increasing, distinct ID.
    // -------------------------------------------------------------------------
    #[test]
    fn sequential_voucher_ids_are_unique() {
        let f = Fixture::new();
        let value: u128 = 1_000_000_000_000_000_000;
        let players = [&f.player_a, &f.player_b, &f.player_c];

        let ids: Vec<u128> = players
            .iter()
            .map(|p| f.reward.mint_voucher(&f.admin, p, &value))
            .collect();

        // All IDs must be distinct
        let mut sorted = ids.clone();
        sorted.sort_unstable();
        sorted.dedup();
        assert_eq!(sorted.len(), ids.len(), "voucher IDs must be unique");

        // IDs must be strictly increasing (VOUCHER_ID_START + 0, +1, +2)
        for w in ids.windows(2) {
            assert!(w[1] > w[0], "voucher IDs must be monotonically increasing");
        }
    }

    // -------------------------------------------------------------------------
    // Scenario 8: Reward fund survives partial redemptions
    //
    // After N partial redemptions the residual balance equals
    // REWARD_FUND − sum(redeemed).
    // -------------------------------------------------------------------------
    #[test]
    fn reward_fund_survives_partial_redemptions() {
        let f = Fixture::new();
        let amounts: &[u128] = &[
            5_000_000_000_000_000_000_000,
            15_000_000_000_000_000_000_000,
            30_000_000_000_000_000_000_000,
        ];
        let total_redeemed: i128 = amounts.iter().map(|&a| a as i128).sum();

        let players = [&f.player_a, &f.player_b, &f.player_c];
        let tids: Vec<u128> = amounts
            .iter()
            .zip(players.iter())
            .map(|(&v, &p)| f.reward.mint_voucher(&f.admin, p, &v))
            .collect();

        // Redeem only the first two
        f.reward.redeem_voucher_from(&f.player_a, &tids[0]);
        f.reward.redeem_voucher_from(&f.player_b, &tids[1]);

        let partial_redeemed = amounts[0] as i128 + amounts[1] as i128;
        assert_eq!(
            f.tyc_balance(&f.reward_id),
            REWARD_FUND - partial_redeemed,
            "residual balance after partial redemptions is wrong"
        );

        // Redeem the third
        f.reward.redeem_voucher_from(&f.player_c, &tids[2]);
        assert_eq!(
            f.tyc_balance(&f.reward_id),
            REWARD_FUND - total_redeemed,
            "residual balance after all redemptions is wrong"
        );
    }

    // -------------------------------------------------------------------------
    // Scenario 9: Multi-voucher batch then bulk redeem out-of-order
    //
    // Three vouchers minted in one batch; redeemed in reverse order.
    // Each player receives exactly their voucher value.
    // -------------------------------------------------------------------------
    #[test]
    fn multi_voucher_batch_then_bulk_redeem() {
        let f = Fixture::new();
        let values: [u128; 3] = [
            1_000_000_000_000_000_000_000,
            2_000_000_000_000_000_000_000,
            3_000_000_000_000_000_000_000,
        ];
        let players = [&f.player_a, &f.player_b, &f.player_c];

        // Batch mint
        let tids: [u128; 3] =
            core::array::from_fn(|i| f.reward.mint_voucher(&f.admin, players[i], &values[i]));

        // Bulk redeem in reverse order
        f.reward.redeem_voucher_from(&f.player_c, &tids[2]);
        f.reward.redeem_voucher_from(&f.player_b, &tids[1]);
        f.reward.redeem_voucher_from(&f.player_a, &tids[0]);

        for (i, &p) in players.iter().enumerate() {
            assert_eq!(
                f.tyc_balance(p),
                values[i] as i128,
                "player {i} received wrong TYC amount"
            );
            assert_eq!(
                f.reward.get_balance(p, &tids[i]),
                0,
                "voucher {i} must be burned after redeem"
            );
        }
    }

    // -------------------------------------------------------------------------
    // Scenario 10: set_collectible_info overwrites previous value
    //
    // Writing collectible info twice must leave only the second write visible.
    // -------------------------------------------------------------------------
    #[test]
    fn game_collectible_update_overwrites() {
        let f = Fixture::new();
        let token_id: u128 = 99;

        f.game
            .set_collectible_info(&token_id, &1, &10, &100_000_000_000_000_000_000, &500_000, &50);
        let first = f.game.get_collectible_info(&token_id);
        assert_eq!(first, (1, 10, 100_000_000_000_000_000_000, 500_000, 50));

        // Overwrite with new values
        f.game.set_collectible_info(
            &token_id,
            &5,
            &20,
            &200_000_000_000_000_000_000,
            &1_000_000,
            &25,
        );
        let second = f.game.get_collectible_info(&token_id);
        assert_eq!(second, (5, 20, 200_000_000_000_000_000_000, 1_000_000, 25));
        assert_ne!(first, second, "second write must overwrite first");
    }

    // -------------------------------------------------------------------------
    // Scenario 11: Cash tier slots are independent
    //
    // Writing to tier 1, 2, 3 must not bleed into each other.
    // -------------------------------------------------------------------------
    #[test]
    fn cash_tier_independent_slots() {
        let f = Fixture::new();

        f.game.set_cash_tier_value(&1, &1_000_000_000_000_000_000_000);
        f.game.set_cash_tier_value(&2, &2_000_000_000_000_000_000_000);
        f.game.set_cash_tier_value(&3, &3_000_000_000_000_000_000_000);

        assert_eq!(
            f.game.get_cash_tier_value(&1),
            1_000_000_000_000_000_000_000
        );
        assert_eq!(
            f.game.get_cash_tier_value(&2),
            2_000_000_000_000_000_000_000
        );
        assert_eq!(
            f.game.get_cash_tier_value(&3),
            3_000_000_000_000_000_000_000
        );

        // Overwrite tier 2 and verify tiers 1 and 3 are unaffected
        f.game.set_cash_tier_value(&2, &9_999_000_000_000_000_000_000);
        assert_eq!(
            f.game.get_cash_tier_value(&1),
            1_000_000_000_000_000_000_000
        );
        assert_eq!(
            f.game.get_cash_tier_value(&2),
            9_999_000_000_000_000_000_000
        );
        assert_eq!(
            f.game.get_cash_tier_value(&3),
            3_000_000_000_000_000_000_000
        );
    }

    // -------------------------------------------------------------------------
    // Scenario 12: Registered player data persists after remove_player_from_game
    //
    // remove_player_from_game is a game-session removal (emits an event and
    // records the turn count) but does NOT erase the on-chain User record.
    // The player's profile must still be readable after the call, and a second
    // registration attempt must be rejected because the address is still marked
    // as registered.
    // -------------------------------------------------------------------------
    #[test]
    fn player_data_persists_after_game_removal() {
        let f = Fixture::new();
        let name = String::from_str(&f.env, "alice");

        // Register
        f.game.register_player(&name, &f.player_a);
        assert!(f.game.get_user(&f.player_a).is_some());

        // Backend removes the player from the game session
        f.game
            .remove_player_from_game(&f.backend, &1, &f.player_a, &3);

        // User record must still exist (remove_player_from_game is session-scoped)
        let user = f.game.get_user(&f.player_a).unwrap();
        assert_eq!(user.username, name);

        // Re-registration must be rejected — address is still registered
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game
                .register_player(&String::from_str(&f.env, "alice2"), &f.player_a);
        }));
        assert!(res.is_err(), "re-registration of existing address must be rejected");
    }
}
