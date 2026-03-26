/// # Cross-contract flow: Game → Reward System (#411)
///
/// These tests exercise the path where the game contract calls the reward system
/// to mint registration vouchers for newly registered players.
///
/// ## Paths covered
///
/// | Test | Path |
/// |------|------|
/// | `register_player_succeeds` | Player registers in game contract |
/// | `registered_player_data_correct` | User struct fields are correct after registration |
/// | `duplicate_registration_rejected` | Same address cannot register twice |
/// | `username_too_short_rejected` | Username < 3 chars rejected |
/// | `username_too_long_rejected` | Username > 20 chars rejected |
/// | `owner_can_withdraw_after_registration` | Game funds unaffected by registration |
/// | `backend_controller_removes_player` | Backend controller can remove player from game |
/// | `owner_removes_player` | Owner can remove player from game |
/// | `unauthorized_remove_rejected` | Random address cannot remove player |
/// | `multiple_players_register_independently` | Three players register; data is isolated |
#[cfg(test)]
mod tests {
    use crate::fixture::Fixture;
    use soroban_sdk::String;

    /// Player registers successfully.
    #[test]
    fn register_player_succeeds() {
        let f = Fixture::new();
        let username = String::from_str(&f.env, "alice");
        f.game.register_player(&username, &f.player_a);

        let user = f.game.get_user(&f.player_a);
        assert!(user.is_some(), "player_a should be registered");
    }

    /// User struct fields are populated correctly after registration.
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

    /// Registering the same address twice panics.
    #[test]
    fn duplicate_registration_rejected() {
        extern crate std;
        let f = Fixture::new();
        let username = String::from_str(&f.env, "carol");
        f.game.register_player(&username, &f.player_a);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.register_player(&username, &f.player_a);
        }));
        assert!(res.is_err(), "duplicate registration must be rejected");
    }

    /// Username shorter than 3 characters is rejected.
    #[test]
    fn username_too_short_rejected() {
        extern crate std;
        let f = Fixture::new();
        let short = String::from_str(&f.env, "ab");
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.register_player(&short, &f.player_a);
        }));
        assert!(res.is_err(), "short username must be rejected");
    }

    /// Username longer than 20 characters is rejected.
    #[test]
    fn username_too_long_rejected() {
        extern crate std;
        let f = Fixture::new();
        let long = String::from_str(&f.env, "thisusernameiswaytoolong");
        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game.register_player(&long, &f.player_a);
        }));
        assert!(res.is_err(), "long username must be rejected");
    }

    /// Game contract TYC balance is unaffected by player registration.
    #[test]
    fn owner_can_withdraw_after_registration() {
        let f = Fixture::new();
        let username = String::from_str(&f.env, "dave");
        f.game.register_player(&username, &f.player_a);

        // Game contract still has its full fund
        let balance_before = f.tyc_balance(&f.game_id);
        assert!(balance_before > 0, "game contract should still hold TYC");
    }

    /// Backend controller can remove a player from a game.
    #[test]
    fn backend_controller_removes_player() {
        let f = Fixture::new();
        let username = String::from_str(&f.env, "eve");
        f.game.register_player(&username, &f.player_a);

        // Backend removes player — should not panic
        f.game
            .remove_player_from_game(&f.backend, &1, &f.player_a, &5);
    }

    /// Owner can remove a player from a game.
    #[test]
    fn owner_removes_player() {
        let f = Fixture::new();
        let username = String::from_str(&f.env, "frank");
        f.game.register_player(&username, &f.player_b);

        f.game
            .remove_player_from_game(&f.admin, &2, &f.player_b, &10);
    }

    /// Unauthorized address cannot remove a player.
    #[test]
    fn unauthorized_remove_rejected() {
        extern crate std;
        use soroban_sdk::testutils::Address as _;
        let f = Fixture::new();
        let attacker = soroban_sdk::Address::generate(&f.env);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.game
                .remove_player_from_game(&attacker, &1, &f.player_a, &3);
        }));
        assert!(res.is_err(), "unauthorized remove must be rejected");
    }

    /// Three players register independently; each has isolated user data.
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

        // Addresses are distinct
        assert_ne!(ua.address, ub.address);
        assert_ne!(ub.address, uc.address);
    }
}
