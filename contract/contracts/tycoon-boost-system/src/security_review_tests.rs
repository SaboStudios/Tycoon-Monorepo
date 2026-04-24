/// # Security Review Tests — tycoon-boost-system (SW-CONTRACT-HYGIENE-001 / SW-CT-025)
///
/// Covers the security properties enumerated in SECURITY_REVIEW_CHECKLIST.md.
///
/// ## Access Control
/// | Test | Assertion |
/// |------|-----------|
/// | `only_admin_can_add_boost`              | non-admin add_boost is rejected |
/// | `only_admin_can_clear_boosts`           | non-admin clear_boosts is rejected |
/// | `only_admin_can_grant_boost`            | non-admin admin_grant_boost is rejected |
/// | `only_admin_can_revoke_boost`           | non-admin admin_revoke_boost is rejected |
/// | `initialize_is_one_time`               | second initialize panics AlreadyInitialized |
/// | `uninitialized_add_boost_rejected`     | add_boost before initialize panics NotInitialized |
///
/// ## Input Validation
/// | Test | Assertion |
/// |------|-----------|
/// | `zero_value_boost_rejected`            | value=0 panics InvalidValue |
/// | `past_expiry_boost_rejected`           | expires_at_ledger <= current panics InvalidExpiry |
/// | `current_ledger_expiry_rejected`       | expires_at_ledger == current panics InvalidExpiry |
/// | `duplicate_id_rejected`               | same boost id panics DuplicateId |
/// | `cap_exceeded_rejected`               | 11th boost panics CapExceeded |
/// | `expired_boost_frees_cap_slot`        | expired boost pruned before cap check |
///
/// ## Privilege Escalation
/// | Test | Assertion |
/// |------|-----------|
/// | `player_cannot_self_grant_boost`       | player cannot call admin_grant_boost |
/// | `player_cannot_revoke_own_boost`       | player cannot call admin_revoke_boost |
///
/// ## Arithmetic Safety
/// | Test | Assertion |
/// |------|-----------|
/// | `stacking_no_overflow_at_max_cap`      | 10 max-value boosts do not overflow u32 |
/// | `additive_sum_stays_in_u32`            | 10 × 10000 bp additive = 110000 fits u32 |
///
/// ## Expiry Semantics
/// | Test | Assertion |
/// |------|-----------|
/// | `zero_expiry_never_expires`            | expires_at_ledger=0 active at ledger 1_000_000 |
/// | `expired_boost_excluded_from_total`    | expired boost not counted in calculate_total_boost |
/// | `calculate_does_not_mutate_storage`    | get_boosts still returns expired after calculate |
#[cfg(test)]
mod tests {
    extern crate std;
    use crate::{
        Boost, BoostType, TycoonBoostSystem, TycoonBoostSystemClient, MAX_BOOSTS_PER_PLAYER,
    };
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo, MockAuth, MockAuthInvoke},
        Address, Env, IntoVal,
    };

    // ── helpers ───────────────────────────────────────────────────────────────

    fn make_env() -> Env {
        let env = Env::default();
        env.mock_all_auths();
        env
    }

    fn setup(env: &Env) -> (TycoonBoostSystemClient, Address, Address) {
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(env, &contract_id);
        let admin = Address::generate(env);
        let player = Address::generate(env);
        client.initialize(&admin);
        (client, admin, player)
    }

    fn set_ledger(env: &Env, seq: u32) {
        env.ledger().set(LedgerInfo {
            sequence_number: seq,
            timestamp: seq as u64 * 5,
            protocol_version: 23,
            network_id: Default::default(),
            base_reserve: 10,
            min_temp_entry_ttl: 1,
            min_persistent_entry_ttl: 1,
            max_entry_ttl: 100_000,
        });
    }

    fn nb(id: u128, value: u32) -> Boost {
        Boost {
            id,
            boost_type: BoostType::Additive,
            value,
            priority: 0,
            expires_at_ledger: 0,
        }
    }

    fn eb(id: u128, value: u32, expires: u32) -> Boost {
        Boost {
            id,
            boost_type: BoostType::Additive,
            value,
            priority: 0,
            expires_at_ledger: expires,
        }
    }

    // ── Access Control ────────────────────────────────────────────────────────

    /// Non-admin address must not call `add_boost`.
    #[test]
    fn only_admin_can_add_boost() {
        let env = Env::default();
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let player = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin);

        // Provide only attacker auth — admin auth is absent
        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "add_boost",
                args: (&player, nb(1, 500)).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.add_boost(&player, &nb(1, 500));
        }));
        assert!(res.is_err(), "non-admin must not call add_boost");
    }

    /// Non-admin address must not call `clear_boosts`.
    #[test]
    fn only_admin_can_clear_boosts() {
        let env = Env::default();
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let player = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin);
        client.add_boost(&player, &nb(1, 500));

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "clear_boosts",
                args: (&player,).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.clear_boosts(&player);
        }));
        assert!(res.is_err(), "non-admin must not call clear_boosts");
    }

    /// Non-admin address must not call `admin_grant_boost`.
    #[test]
    fn only_admin_can_grant_boost() {
        let env = Env::default();
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let player = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin);

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_grant_boost",
                args: (&player, nb(1, 500)).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.admin_grant_boost(&player, &nb(1, 500));
        }));
        assert!(res.is_err(), "non-admin must not call admin_grant_boost");
    }

    /// Non-admin address must not call `admin_revoke_boost`.
    #[test]
    fn only_admin_can_revoke_boost() {
        let env = Env::default();
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let attacker = Address::generate(&env);
        let player = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin);
        client.admin_grant_boost(&player, &nb(1, 500));

        env.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_revoke_boost",
                args: (&player, 1_u128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.admin_revoke_boost(&player, &1u128);
        }));
        assert!(res.is_err(), "non-admin must not call admin_revoke_boost");
    }

    /// `initialize` can only be called once.
    #[test]
    #[should_panic(expected = "AlreadyInitialized")]
    fn initialize_is_one_time() {
        let env = make_env();
        let (client, admin, _) = setup(&env);
        client.initialize(&admin);
    }

    /// `add_boost` before `initialize` panics with `"NotInitialized"`.
    #[test]
    #[should_panic(expected = "NotInitialized")]
    fn uninitialized_add_boost_rejected() {
        let env = make_env();
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(&env, &contract_id);
        let player = Address::generate(&env);
        client.add_boost(&player, &nb(1, 500));
    }

    // ── Input Validation ──────────────────────────────────────────────────────

    /// `value == 0` must panic with `"InvalidValue"`.
    #[test]
    #[should_panic(expected = "InvalidValue")]
    fn zero_value_boost_rejected() {
        let env = make_env();
        let (client, _, player) = setup(&env);
        client.add_boost(&player, &nb(1, 0));
    }

    /// `expires_at_ledger` in the past must panic with `"InvalidExpiry"`.
    #[test]
    #[should_panic(expected = "InvalidExpiry")]
    fn past_expiry_boost_rejected() {
        let env = make_env();
        set_ledger(&env, 500);
        let (client, _, player) = setup(&env);
        client.add_boost(&player, &eb(1, 500, 499));
    }

    /// `expires_at_ledger == current_ledger` must panic with `"InvalidExpiry"`.
    #[test]
    #[should_panic(expected = "InvalidExpiry")]
    fn current_ledger_expiry_rejected() {
        let env = make_env();
        set_ledger(&env, 100);
        let (client, _, player) = setup(&env);
        client.add_boost(&player, &eb(1, 500, 100));
    }

    /// Duplicate boost id must panic with `"DuplicateId"`.
    #[test]
    #[should_panic(expected = "DuplicateId")]
    fn duplicate_id_rejected() {
        let env = make_env();
        let (client, _, player) = setup(&env);
        client.add_boost(&player, &nb(42, 500));
        client.add_boost(&player, &nb(42, 300));
    }

    /// 11th boost must panic with `"CapExceeded"`.
    #[test]
    #[should_panic(expected = "CapExceeded")]
    fn cap_exceeded_rejected() {
        let env = make_env();
        let (client, _, player) = setup(&env);
        for i in 0..MAX_BOOSTS_PER_PLAYER {
            client.add_boost(&player, &nb(i as u128 + 1, 100));
        }
        client.add_boost(&player, &nb(99, 100));
    }

    /// Expired boost is pruned before cap check — slot freed for new boost.
    #[test]
    fn expired_boost_frees_cap_slot() {
        let env = make_env();
        set_ledger(&env, 100);
        let (client, _, player) = setup(&env);

        for i in 0..9u128 {
            client.add_boost(&player, &nb(i + 1, 100));
        }
        // 10th boost expires at ledger 200
        client.add_boost(&player, &eb(10, 100, 200));

        set_ledger(&env, 201);

        // 11th add should succeed because expired boost is pruned first
        client.add_boost(&player, &nb(11, 100));
        assert_eq!(client.get_active_boosts(&player).len(), 10);
    }

    // ── Privilege Escalation ──────────────────────────────────────────────────

    /// A player (non-admin) cannot call `admin_grant_boost` on themselves.
    #[test]
    fn player_cannot_self_grant_boost() {
        let env = Env::default();
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let player = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin);

        // Player tries to grant themselves a boost
        env.mock_auths(&[MockAuth {
            address: &player,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_grant_boost",
                args: (&player, nb(1, 5000)).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.admin_grant_boost(&player, &nb(1, 5000));
        }));
        assert!(res.is_err(), "player must not self-grant a boost");
    }

    /// A player cannot call `admin_revoke_boost` to remove their own boost.
    #[test]
    fn player_cannot_revoke_own_boost() {
        let env = Env::default();
        let contract_id = env.register(TycoonBoostSystem, ());
        let client = TycoonBoostSystemClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let player = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(&admin);
        client.admin_grant_boost(&player, &nb(1, 500));

        env.mock_auths(&[MockAuth {
            address: &player,
            invoke: &MockAuthInvoke {
                contract: &contract_id,
                fn_name: "admin_revoke_boost",
                args: (&player, 1_u128).into_val(&env),
                sub_invokes: &[],
            },
        }]);

        let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            client.admin_revoke_boost(&player, &1u128);
        }));
        assert!(res.is_err(), "player must not revoke their own boost");
    }

    // ── Arithmetic Safety ─────────────────────────────────────────────────────

    /// 10 multiplicative boosts at 2x each must not overflow u32.
    #[test]
    fn stacking_no_overflow_at_max_cap() {
        let env = make_env();
        let (client, _, player) = setup(&env);

        for i in 0..MAX_BOOSTS_PER_PLAYER {
            client.add_boost(&player, &Boost {
                id: i as u128 + 1,
                boost_type: BoostType::Multiplicative,
                value: 20000, // 2x
                priority: 0,
                expires_at_ledger: 0,
            });
        }

        // 10000 * 2^10 = 10_240_000 — fits in u32 (max ~4.29B)
        let total = client.calculate_total_boost(&player);
        assert!(total > 10000, "stacked boosts must exceed base");
        assert!(total <= u32::MAX, "result must not overflow u32");
    }

    /// 10 additive boosts at 10000 bp each: result = 10000 * (1 + 10.0) = 110000.
    #[test]
    fn additive_sum_stays_in_u32() {
        let env = make_env();
        let (client, _, player) = setup(&env);

        for i in 0..MAX_BOOSTS_PER_PLAYER {
            client.add_boost(&player, &nb(i as u128 + 1, 10000));
        }

        // 10000 * (1 + 10*1.0) = 110000 — fits in u32
        let total = client.calculate_total_boost(&player);
        assert_eq!(total, 110000);
    }

    // ── Expiry Semantics ──────────────────────────────────────────────────────

    /// `expires_at_ledger == 0` means the boost never expires.
    #[test]
    fn zero_expiry_never_expires() {
        let env = make_env();
        set_ledger(&env, 1);
        let (client, _, player) = setup(&env);

        client.add_boost(&player, &nb(1, 1000));

        set_ledger(&env, 1_000_000);
        assert_eq!(client.calculate_total_boost(&player), 11000);
    }

    /// Expired boost is excluded from `calculate_total_boost`.
    #[test]
    fn expired_boost_excluded_from_total() {
        let env = make_env();
        set_ledger(&env, 100);
        let (client, _, player) = setup(&env);

        client.add_boost(&player, &eb(1, 5000, 150));

        set_ledger(&env, 150);
        assert_eq!(client.calculate_total_boost(&player), 10000);
    }

    /// `calculate_total_boost` does not mutate storage — expired boost still in `get_boosts`.
    #[test]
    fn calculate_does_not_mutate_storage() {
        let env = make_env();
        set_ledger(&env, 100);
        let (client, _, player) = setup(&env);

        client.add_boost(&player, &eb(1, 1000, 150));

        set_ledger(&env, 200);
        assert_eq!(client.calculate_total_boost(&player), 10000);

        // Storage not mutated — expired boost still present via get_boosts
        assert_eq!(client.get_boosts(&player).len(), 1);
    }

    // ── SEC-02: additive_total u32 wrapping overflow ──────────────────────────

    /// Documents that additive_total wraps on u32 overflow.
    /// Pins current (wrapping) behavior so any future fix is visible.
    #[test]
    fn test_additive_overflow_wraps() {
        let env = make_env();
        let (client, _, player) = setup(&env);

        // Each value = 429_496_730 (≈ u32::MAX / 10 + 1)
        // 10 × 429_496_730 = 4_294_967_300 which wraps to 4 in u32
        let per_boost: u32 = u32::MAX / 10 + 1;
        for i in 0..10u128 {
            client.add_boost(&player, &nb(i, per_boost));
        }

        let total = client.calculate_total_boost(&player);
        let correct_additive_sum = (per_boost as u64) * 10;
        let expected_if_no_overflow =
            (10000u64 * (10000 + correct_additive_sum) / 10000) as u32;
        assert_ne!(
            total, expected_if_no_overflow,
            "SEC-02: additive overflow no longer wraps — update checklist"
        );
    }

    // ── SEC-03: mixed-stacking final cast truncation ──────────────────────────

    /// Documents that the final `as u32` cast in apply_stacking_rules silently
    /// truncates when the result exceeds u32::MAX.
    /// Pins current behavior; a future fix will cause this test to fail.
    #[test]
    fn test_mixed_overflow_truncates() {
        let env = make_env();
        let (client, _, player) = setup(&env);

        let large = u32::MAX / 2;
        client.add_boost(&player, &Boost {
            id: 1,
            boost_type: BoostType::Multiplicative,
            value: large,
            priority: 0,
            expires_at_ledger: 0,
        });
        client.add_boost(&player, &Boost {
            id: 2,
            boost_type: BoostType::Multiplicative,
            value: large,
            priority: 0,
            expires_at_ledger: 0,
        });

        let total = client.calculate_total_boost(&player);

        let step1 = 10000u64 * large as u64 / 10000;
        let step2 = step1 * large as u64 / 10000;
        let correct_u64 = step2 * 10000 / 10000;

        if correct_u64 > u32::MAX as u64 {
            assert_eq!(
                total,
                correct_u64 as u32,
                "SEC-03: truncation behavior changed — update checklist"
            );
        }
    }
}
