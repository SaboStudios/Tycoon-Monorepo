/// # Cross-contract flow: Boost System — Admin Grant / Revoke (#SW-CONTRACT-BOOST-001)
///
/// Integration tests for admin-controlled boost operations in the full Tycoon ecosystem.
/// These tests use the shared `Fixture` (which initializes the boost system with an admin)
/// and exercise paths that are only available through the admin entrypoints.
///
/// | Test | Cross-contract path |
/// |------|---------------------|
/// | `admin_grants_boost_to_player`                    | admin → boost_system.admin_grant_boost |
/// | `admin_revokes_boost_from_player`                 | admin → boost_system.admin_revoke_boost |
/// | `admin_grant_affects_total_boost_calculation`     | grant → calculate_total_boost |
/// | `admin_revoke_is_idempotent_for_missing_id`       | revoke non-existent id → no panic |
/// | `admin_grant_and_player_self_add_coexist`         | admin grant + player add_boost |
/// | `admin_grant_expiring_boost_expires_correctly`    | admin grant with expiry → ledger advance |
/// | `admin_grant_boost_cap_enforcement`               | admin grant respects MAX_BOOSTS_PER_PLAYER |
/// | `admin_grant_duplicate_id_rejected`               | admin grant duplicate id panics |
/// | `admin_revoke_does_not_affect_other_players`      | revoke scoped to one player |
/// | `admin_grant_boost_affects_reward_calculation`    | grant → boosted reward value |
/// | `admin_grant_override_boost_supersedes_player`    | admin override > player additive |
/// | `admin_grant_then_clear_by_player`                | player can clear admin-granted boosts |
/// | `fixture_boost_system_is_initialized`             | boost_system.admin() == fixture.admin |
#[cfg(test)]
mod tests {
    extern crate std;

    use crate::fixture::Fixture;
    use soroban_sdk::{
        testutils::{Address as _, Ledger, LedgerInfo},
        Address, Env,
    };
    use tycoon_boost_system::{Boost, BoostType};

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

    fn nb(id: u128, boost_type: BoostType, value: u32, priority: u32) -> Boost {
        Boost {
            id,
            boost_type,
            value,
            priority,
            expires_at_ledger: 0,
        }
    }

    fn eb(id: u128, boost_type: BoostType, value: u32, priority: u32, expires: u32) -> Boost {
        Boost {
            id,
            boost_type,
            value,
            priority,
            expires_at_ledger: expires,
        }
    }

    // ── Fixture sanity ────────────────────────────────────────────────────────

    /// The fixture initializes the boost system with the fixture admin.
    /// `boost_system.admin()` must return the same address as `fixture.admin`.
    #[test]
    fn fixture_boost_system_is_initialized() {
        let f = Fixture::new();
        assert_eq!(f.boost_system.admin(), f.admin);
    }

    // ── admin_grant_boost ─────────────────────────────────────────────────────

    /// Admin can grant a boost to a player without the player signing.
    #[test]
    fn admin_grants_boost_to_player() {
        let f = Fixture::new();
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 2000, 0));

        let active = f.boost_system.get_active_boosts(&f.player_a);
        assert_eq!(active.len(), 1);
        assert_eq!(active.get(0).unwrap().id, 1);
        assert_eq!(active.get(0).unwrap().value, 2000);
    }

    /// Admin-granted boost is included in `calculate_total_boost`.
    #[test]
    fn admin_grant_affects_total_boost_calculation() {
        let f = Fixture::new();
        // +50% additive
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 5000, 0));

        // 10000 * (1 + 0.50) = 15000
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 15000);
    }

    /// Admin-granted boost with expiry expires at the correct ledger.
    #[test]
    fn admin_grant_expiring_boost_expires_correctly() {
        let f = Fixture::new();
        set_ledger(&f.env, 100);

        f.boost_system.admin_grant_boost(
            &f.player_b,
            &eb(1, BoostType::Multiplicative, 15000, 0, 200),
        );

        // Active at ledger 150
        set_ledger(&f.env, 150);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 15000);

        // Expired at ledger 200
        set_ledger(&f.env, 200);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 10000);
    }

    /// Admin grant respects the MAX_BOOSTS_PER_PLAYER cap.
    #[test]
    fn admin_grant_boost_cap_enforcement() {
        let f = Fixture::new();
        // Fill to cap via admin_grant_boost
        for i in 0..10u128 {
            f.boost_system
                .admin_grant_boost(&f.player_a, &nb(i + 1, BoostType::Additive, 100, 0));
        }
        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 10);

        // 11th grant must panic
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.boost_system
                .admin_grant_boost(&f.player_a, &nb(99, BoostType::Additive, 100, 0));
        }));
        assert!(result.is_err(), "Expected CapExceeded panic");
    }

    /// Admin grant with a duplicate boost id must panic.
    #[test]
    fn admin_grant_duplicate_id_rejected() {
        let f = Fixture::new();
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(42, BoostType::Additive, 1000, 0));

        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            f.boost_system
                .admin_grant_boost(&f.player_a, &nb(42, BoostType::Additive, 500, 0));
        }));
        assert!(result.is_err(), "Expected DuplicateId panic");
    }

    // ── admin_revoke_boost ────────────────────────────────────────────────────

    /// Admin can revoke a specific boost from a player.
    #[test]
    fn admin_revokes_boost_from_player() {
        let f = Fixture::new();
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 2000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(2, BoostType::Additive, 1000, 0));

        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 2);

        f.boost_system.admin_revoke_boost(&f.player_a, &1u128);

        let active = f.boost_system.get_active_boosts(&f.player_a);
        assert_eq!(active.len(), 1);
        assert_eq!(active.get(0).unwrap().id, 2);
        // Only boost 2 (+10%) remains: 10000 * (1 + 0.10) = 11000
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 11000);
    }

    /// Revoking a non-existent boost id is a no-op (idempotent).
    #[test]
    fn admin_revoke_is_idempotent_for_missing_id() {
        let f = Fixture::new();
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 1000, 0));

        // Revoke a non-existent id — must not panic
        f.boost_system.admin_revoke_boost(&f.player_a, &999u128);

        // Original boost still present
        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 1);
    }

    /// Revoking a boost from player_a does not affect player_b.
    #[test]
    fn admin_revoke_does_not_affect_other_players() {
        let f = Fixture::new();
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 1000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(1, BoostType::Additive, 1000, 0));

        f.boost_system.admin_revoke_boost(&f.player_a, &1u128);

        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 0);
        assert_eq!(f.boost_system.get_active_boosts(&f.player_b).len(), 1);
    }

    // ── Mixed admin + player operations ──────────────────────────────────────

    /// Admin-granted boost and player self-added boost coexist and stack correctly.
    #[test]
    fn admin_grant_and_player_self_add_coexist() {
        let f = Fixture::new();
        // Admin grants 1.5x multiplicative
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Multiplicative, 15000, 0));
        // Player self-adds +20% additive
        f.boost_system
            .add_boost(&f.player_a, &nb(2, BoostType::Additive, 2000, 0));

        // 10000 * 1.5 * (1 + 0.20) = 18000
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 18000);
    }

    /// Admin override boost supersedes player-added additive and multiplicative boosts.
    #[test]
    fn admin_grant_override_boost_supersedes_player() {
        let f = Fixture::new();
        // Player adds various boosts
        f.boost_system
            .add_boost(&f.player_a, &nb(1, BoostType::Multiplicative, 20000, 0));
        f.boost_system
            .add_boost(&f.player_a, &nb(2, BoostType::Additive, 5000, 0));

        // Admin grants a VIP override (5x)
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(3, BoostType::Override, 50000, 100));

        // Override wins — all other boosts ignored
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 50000);
    }

    /// Player can clear all boosts (including admin-granted ones) via `clear_boosts`.
    #[test]
    fn admin_grant_then_clear_by_player() {
        let f = Fixture::new();
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 3000, 0));
        f.boost_system
            .add_boost(&f.player_a, &nb(2, BoostType::Additive, 1000, 0));

        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 2);

        f.boost_system.clear_boosts(&f.player_a);

        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 0);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 10000);
    }

    // ── Cross-contract: boost → reward calculation ────────────────────────────

    /// Admin-granted boost correctly scales a reward calculation.
    ///
    /// This test simulates the backend granting a boost to a player and then
    /// using the boost multiplier to scale a TYC reward voucher.
    #[test]
    fn admin_grant_boost_affects_reward_calculation() {
        let f = Fixture::new();

        // Admin grants player_a a 2x multiplicative boost
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Multiplicative, 20000, 0));

        // Fetch the multiplier
        let multiplier = f.boost_system.calculate_total_boost(&f.player_a);
        assert_eq!(multiplier, 20000); // 2x

        // Base reward: 100 TYC (18 decimals)
        let base_reward: u128 = 100_000_000_000_000_000_000;
        let boosted_reward = base_reward * multiplier as u128 / 10_000;
        // 100 TYC * 2 = 200 TYC
        assert_eq!(boosted_reward, 200_000_000_000_000_000_000);

        // Mint the boosted reward voucher and redeem it
        let tid = f
            .reward
            .mint_voucher(&f.admin, &f.player_a, &boosted_reward);
        f.reward.redeem_voucher_from(&f.player_a, &tid);

        assert_eq!(f.tyc_balance(&f.player_a), boosted_reward as i128);
    }

    /// Admin-granted boost is revoked before reward calculation — base reward applies.
    #[test]
    fn admin_revoke_before_reward_calculation_uses_base() {
        let f = Fixture::new();

        // Admin grants then immediately revokes
        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(1, BoostType::Multiplicative, 30000, 0));
        f.boost_system.admin_revoke_boost(&f.player_b, &1u128);

        // Multiplier should be base (no boost)
        let multiplier = f.boost_system.calculate_total_boost(&f.player_b);
        assert_eq!(multiplier, 10000);

        // Reward is unscaled
        let base_reward: u128 = 50_000_000_000_000_000_000;
        let boosted_reward = base_reward * multiplier as u128 / 10_000;
        assert_eq!(boosted_reward, base_reward);

        let tid = f
            .reward
            .mint_voucher(&f.admin, &f.player_b, &boosted_reward);
        f.reward.redeem_voucher_from(&f.player_b, &tid);
        assert_eq!(f.tyc_balance(&f.player_b), base_reward as i128);
    }

    // ── Multi-player admin scenarios ──────────────────────────────────────────

    /// Admin grants different boosts to all three fixture players; each has
    /// independent state and correct calculations.
    #[test]
    fn admin_grants_independent_boosts_to_all_players() {
        let f = Fixture::new();

        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 1000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(1, BoostType::Multiplicative, 15000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_c, &nb(1, BoostType::Override, 25000, 10));

        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 11000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 15000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_c), 25000);

        // Revoking from player_b leaves others untouched
        f.boost_system.admin_revoke_boost(&f.player_b, &1u128);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 11000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 10000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_c), 25000);
    }

    /// Admin can grant boosts to a freshly-generated player (not in fixture accounts).
    #[test]
    fn admin_grants_boost_to_new_player() {
        let f = Fixture::new();
        let new_player = Address::generate(&f.env);

        f.boost_system
            .admin_grant_boost(&new_player, &nb(1, BoostType::Additive, 2000, 0));

        assert_eq!(f.boost_system.calculate_total_boost(&new_player), 12000);
        // Fixture players unaffected
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 10000);
    }

    // ── Priority and stacking edge cases ──────────────────────────────────────

    /// Admin grants multiple boosts with different priorities; highest priority wins for override.
    #[test]
    fn admin_grant_multiple_priorities_highest_wins() {
        let f = Fixture::new();

        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Override, 20000, 5));
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(2, BoostType::Override, 30000, 10));
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(3, BoostType::Override, 15000, 3));

        // Highest priority (10) wins: 30000
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 30000);
    }

    /// Admin grants additive boosts with different priorities; all stack regardless of priority.
    #[test]
    fn admin_grant_additive_all_stack() {
        let f = Fixture::new();

        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(1, BoostType::Additive, 1000, 1));
        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(2, BoostType::Additive, 2000, 5));
        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(3, BoostType::Additive, 1500, 3));

        // 10000 * (1 + 0.10 + 0.20 + 0.15) = 10000 * 1.45 = 14500
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 14500);
    }

    /// Admin grants multiplicative boosts; all multiply together.
    #[test]
    fn admin_grant_multiplicative_all_multiply() {
        let f = Fixture::new();

        // 1.5x
        f.boost_system
            .admin_grant_boost(&f.player_c, &nb(1, BoostType::Multiplicative, 15000, 0));
        // 2x
        f.boost_system
            .admin_grant_boost(&f.player_c, &nb(2, BoostType::Multiplicative, 20000, 0));

        // 10000 * 1.5 * 2.0 = 30000
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_c), 30000);
    }

    // ── Expiry edge cases ─────────────────────────────────────────────────────

    /// Admin grants boost that expires exactly at current ledger (should be expired).
    #[test]
    fn admin_grant_boost_expires_at_current_ledger() {
        let f = Fixture::new();
        // Grant while ledger is 99 with expiry at 100; becomes inactive once ledger reaches 100.
        set_ledger(&f.env, 99);

        f.boost_system
            .admin_grant_boost(&f.player_a, &eb(1, BoostType::Additive, 5000, 0, 100));

        set_ledger(&f.env, 100);
        // At ledger 100, boost should be expired
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 10000);
    }

    /// Admin grants boost that expires one ledger in the future (should be active).
    #[test]
    fn admin_grant_boost_expires_next_ledger() {
        let f = Fixture::new();
        set_ledger(&f.env, 100);

        f.boost_system
            .admin_grant_boost(&f.player_b, &eb(1, BoostType::Additive, 3000, 0, 101));

        // At ledger 100, boost should be active
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 13000);

        // At ledger 101, boost should be expired
        set_ledger(&f.env, 101);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 10000);
    }

    /// Admin grants multiple boosts with different expiry times; only active ones count.
    #[test]
    fn admin_grant_mixed_expiry_times() {
        let f = Fixture::new();
        set_ledger(&f.env, 100);

        // Never expires
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 1000, 0));
        // Expires at 150
        f.boost_system
            .admin_grant_boost(&f.player_a, &eb(2, BoostType::Additive, 2000, 0, 150));
        // Expires at 120
        f.boost_system
            .admin_grant_boost(&f.player_a, &eb(3, BoostType::Additive, 1500, 0, 120));

        // At ledger 100: all active = 10000 * (1 + 0.10 + 0.20 + 0.15) = 14500
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 14500);

        // At ledger 120: boost 3 expired = 10000 * (1 + 0.10 + 0.20) = 13000
        set_ledger(&f.env, 120);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 13000);

        // At ledger 150: boost 2 expired = 10000 * (1 + 0.10) = 11000
        set_ledger(&f.env, 150);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 11000);
    }

    // ── Revoke edge cases ─────────────────────────────────────────────────────

    /// Admin revokes all boosts one by one; player ends with base multiplier.
    #[test]
    fn admin_revokes_all_boosts_sequentially() {
        let f = Fixture::new();

        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 1000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(2, BoostType::Additive, 2000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(3, BoostType::Additive, 1500, 0));

        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 3);

        f.boost_system.admin_revoke_boost(&f.player_a, &1u128);
        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 2);

        f.boost_system.admin_revoke_boost(&f.player_a, &2u128);
        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 1);

        f.boost_system.admin_revoke_boost(&f.player_a, &3u128);
        assert_eq!(f.boost_system.get_active_boosts(&f.player_a).len(), 0);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 10000);
    }

    /// Admin revokes the same boost id multiple times (idempotent).
    #[test]
    fn admin_revoke_same_id_multiple_times() {
        let f = Fixture::new();

        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(1, BoostType::Additive, 1000, 0));

        f.boost_system.admin_revoke_boost(&f.player_b, &1u128);
        assert_eq!(f.boost_system.get_active_boosts(&f.player_b).len(), 0);

        // Revoke again — should not panic
        f.boost_system.admin_revoke_boost(&f.player_b, &1u128);
        assert_eq!(f.boost_system.get_active_boosts(&f.player_b).len(), 0);

        // Revoke once more
        f.boost_system.admin_revoke_boost(&f.player_b, &1u128);
        assert_eq!(f.boost_system.get_active_boosts(&f.player_b).len(), 0);
    }

    // ── Cross-contract reward scenarios ───────────────────────────────────────

    /// Admin grants boost, player redeems voucher, admin revokes boost, player redeems again.
    #[test]
    fn admin_grant_revoke_between_redemptions() {
        let f = Fixture::new();

        // Admin grants 3x boost
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Multiplicative, 30000, 0));

        // First redemption with boost
        let base_reward: u128 = 100_000_000_000_000_000_000;
        let multiplier1 = f.boost_system.calculate_total_boost(&f.player_a);
        assert_eq!(multiplier1, 30000);
        let boosted1 = base_reward * multiplier1 as u128 / 10_000;
        let tid1 = f.reward.mint_voucher(&f.admin, &f.player_a, &boosted1);
        f.reward.redeem_voucher_from(&f.player_a, &tid1);
        assert_eq!(f.tyc_balance(&f.player_a), boosted1 as i128);

        // Admin revokes boost
        f.boost_system.admin_revoke_boost(&f.player_a, &1u128);

        // Second redemption without boost
        let multiplier2 = f.boost_system.calculate_total_boost(&f.player_a);
        assert_eq!(multiplier2, 10000);
        let boosted2 = base_reward * multiplier2 as u128 / 10_000;
        let tid2 = f.reward.mint_voucher(&f.admin, &f.player_a, &boosted2);
        f.reward.redeem_voucher_from(&f.player_a, &tid2);

        // Total balance = boosted1 + boosted2
        assert_eq!(f.tyc_balance(&f.player_a), (boosted1 + boosted2) as i128);
    }

    /// Admin grants boost to multiple players; each redeems independently.
    #[test]
    fn admin_grants_boosts_multiple_players_redeem_independently() {
        let f = Fixture::new();

        // Different boosts for each player
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Multiplicative, 20000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(1, BoostType::Additive, 5000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_c, &nb(1, BoostType::Override, 40000, 10));

        let base_reward: u128 = 50_000_000_000_000_000_000;

        // player_a: 2x
        let mult_a = f.boost_system.calculate_total_boost(&f.player_a);
        let reward_a = base_reward * mult_a as u128 / 10_000;
        let tid_a = f.reward.mint_voucher(&f.admin, &f.player_a, &reward_a);
        f.reward.redeem_voucher_from(&f.player_a, &tid_a);

        // player_b: 1.5x
        let mult_b = f.boost_system.calculate_total_boost(&f.player_b);
        let reward_b = base_reward * mult_b as u128 / 10_000;
        let tid_b = f.reward.mint_voucher(&f.admin, &f.player_b, &reward_b);
        f.reward.redeem_voucher_from(&f.player_b, &tid_b);

        // player_c: 4x
        let mult_c = f.boost_system.calculate_total_boost(&f.player_c);
        let reward_c = base_reward * mult_c as u128 / 10_000;
        let tid_c = f.reward.mint_voucher(&f.admin, &f.player_c, &reward_c);
        f.reward.redeem_voucher_from(&f.player_c, &tid_c);

        assert_eq!(f.tyc_balance(&f.player_a), reward_a as i128);
        assert_eq!(f.tyc_balance(&f.player_b), reward_b as i128);
        assert_eq!(f.tyc_balance(&f.player_c), reward_c as i128);
    }

    // ── State isolation tests ─────────────────────────────────────────────────

    /// Admin operations on one player do not leak state to other players.
    #[test]
    fn admin_operations_isolated_per_player() {
        let f = Fixture::new();

        // Grant to player_a
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 3000, 0));

        // player_b and player_c should have base multiplier
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 10000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_c), 10000);

        // Revoke from player_a
        f.boost_system.admin_revoke_boost(&f.player_a, &1u128);

        // player_b and player_c still unaffected
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 10000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_c), 10000);
    }

    /// Admin grants same boost id to different players (ids are scoped per player).
    #[test]
    fn admin_grant_same_id_different_players() {
        let f = Fixture::new();

        // Same id (1) for different players
        f.boost_system
            .admin_grant_boost(&f.player_a, &nb(1, BoostType::Additive, 1000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_b, &nb(1, BoostType::Additive, 2000, 0));
        f.boost_system
            .admin_grant_boost(&f.player_c, &nb(1, BoostType::Additive, 3000, 0));

        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 11000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 12000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_c), 13000);

        // Revoke from player_b only
        f.boost_system.admin_revoke_boost(&f.player_b, &1u128);

        assert_eq!(f.boost_system.calculate_total_boost(&f.player_a), 11000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_b), 10000);
        assert_eq!(f.boost_system.calculate_total_boost(&f.player_c), 13000);
    }
}
