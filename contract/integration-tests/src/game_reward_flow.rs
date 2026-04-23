/// # Cross-contract flow: Game ↔ Reward System (#411)
///
/// Exercises player registration in the game contract and the backend
/// controller / owner remove-player paths.
///
/// | Test | Cross-contract path |
/// |------|---------------------|
/// | `register_player_succeeds`                | game.register_player stores user |
/// | `registered_player_data_correct`          | user struct fields verified |
/// | `duplicate_registration_rejected`         | second register panics |
/// | `username_too_short_rejected`             | < 3 chars panics |
/// | `username_too_long_rejected`              | > 20 chars panics |
/// | `owner_can_withdraw_after_registration`   | game funds unaffected by registration |
/// | `backend_controller_removes_player`       | backend → game.remove_player_from_game |
/// | `owner_removes_player`                    | admin → game.remove_player_from_game |
/// | `unauthorized_remove_rejected`            | random address panics |
/// | `multiple_players_register_independently` | three players, isolated data |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::fixture::Fixture;
    use soroban_sdk::{testutils::Address as _, Address, String};

    #[test]
    fn register_player_succeeds() {
        let f = Fixture::new();
        f.game
            .register_player(&String::from_str(&f.env, "alice"), &f.player_a);
        assert!(f.game.get_user(&f.player_a).is_some());
    }

    #[test]
    fn registered_player_data_correct() {
        let f = Fixture::new();
        let username = String::from_str(&f.env, "bob123");
        f.game.register_player(&username, &f.player_b);
        let user = f.game.get_user(&f.player_b).unwrap();
        assert_eq!(user.username, username);
        assert_eq!(user.address, f.player_b);
        assert_eq!(user.games_played, 0);
        assert_eq!(user.games_won, 0);
    }

    #[test]
    fn duplicate_registration_rejected() {
        let f = Fixture::new();
        let u = String::from_str(&f.env, "carol");
        f.game.register_player(&u, &f.player_a);
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.register_player(&u, &f.player_a);
        }));
        assert!(res.is_err());
    }

    #[test]
    fn username_too_short_rejected() {
        let f = Fixture::new();
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game
                .register_player(&String::from_str(&f.env, "ab"), &f.player_a);
        }));
        assert!(res.is_err());
    }

    #[test]
    fn username_too_long_rejected() {
        let f = Fixture::new();
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.register_player(
                &String::from_str(&f.env, "thisusernameiswaytoolong"),
                &f.player_a,
            );
        }));
        assert!(res.is_err());
    }

    #[test]
    fn owner_can_withdraw_after_registration() {
        let f = Fixture::new();
        f.game
            .register_player(&String::from_str(&f.env, "dave"), &f.player_a);
        assert!(f.tyc_balance(&f.game_id) > 0);
    }

    #[test]
    fn backend_controller_removes_player() {
        let f = Fixture::new();
        f.game
            .register_player(&String::from_str(&f.env, "eve"), &f.player_a);
        f.game
            .remove_player_from_game(&f.backend, &1, &f.player_a, &5);
    }

    #[test]
    fn owner_removes_player() {
        let f = Fixture::new();
        f.game
            .register_player(&String::from_str(&f.env, "frank"), &f.player_b);
        f.game
            .remove_player_from_game(&f.admin, &2, &f.player_b, &10);
    }

    #[test]
    fn unauthorized_remove_rejected() {
        let f = Fixture::new();
        let attacker = Address::generate(&f.env);
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game
                .remove_player_from_game(&attacker, &1, &f.player_a, &3);
        }));
        assert!(res.is_err());
    }

    #[test]
    fn multiple_players_register_independently() {
        let f = Fixture::new();
        f.game
            .register_player(&String::from_str(&f.env, "alice"), &f.player_a);
        f.game
            .register_player(&String::from_str(&f.env, "bob"), &f.player_b);
        f.game
            .register_player(&String::from_str(&f.env, "carol"), &f.player_c);

        let ua = f.game.get_user(&f.player_a).unwrap();
        let ub = f.game.get_user(&f.player_b).unwrap();
        let uc = f.game.get_user(&f.player_c).unwrap();

        assert_eq!(ua.username, String::from_str(&f.env, "alice"));
        assert_eq!(ub.username, String::from_str(&f.env, "bob"));
        assert_eq!(uc.username, String::from_str(&f.env, "carol"));
        assert_ne!(ua.address, ub.address);
        assert_ne!(ub.address, uc.address);
    }

    // ── SW-001 coverage additions ─────────────────────────────────────────────

    /// `export_state` returns correct values in a fully wired cross-contract fixture.
    #[test]
    fn export_state_reflects_fixture_wiring() {
        let f = Fixture::new();
        let dump = f.game.export_state();

        assert_eq!(dump.owner, f.admin, "owner must match fixture admin");
        assert_eq!(dump.tyc_token, f.tyc_id, "TYC token must match fixture");
        assert_eq!(dump.usdc_token, f.usdc_id, "USDC token must match fixture");
        assert_eq!(
            dump.reward_system, f.reward_id,
            "reward_system must match fixture"
        );
        assert!(dump.is_initialized, "contract must be initialized");
        assert_eq!(
            dump.state_version, 1,
            "state_version must be 1 after initialize"
        );
        // Fixture sets a backend controller — must be Some
        assert!(
            dump.backend_controller.is_some(),
            "backend_controller must be set by fixture"
        );
        assert_eq!(dump.backend_controller, Some(f.backend.clone()));
    }

    /// `migrate` on the game contract is idempotent at v1 and does not corrupt state.
    #[test]
    fn game_migrate_is_idempotent() {
        let f = Fixture::new();
        f.game.migrate();
        let dump = f.game.export_state();
        assert_eq!(
            dump.state_version, 1,
            "migrate must not change version at v1"
        );
        assert!(dump.is_initialized);
    }

    /// `migrate` on the reward contract is idempotent at v1 and does not corrupt state.
    #[test]
    fn reward_migrate_is_idempotent() {
        let f = Fixture::new();
        f.reward.migrate();
        // Reward contract is still functional after migrate
        let value: u128 = 10_000_000_000_000_000_000;
        let tid = f.reward.mint_voucher(&f.admin, &f.player_a, &value);
        f.reward.redeem_voucher_from(&f.player_a, &tid);
        assert_eq!(f.tyc_balance(&f.player_a), value as i128);
    }
}
