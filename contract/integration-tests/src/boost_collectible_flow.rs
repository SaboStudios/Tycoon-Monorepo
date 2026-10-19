//! Cross-contract integration flows for the boost-system and collectibles
//! contracts.
//!
//! These tests deploy the boost-system and collectibles contracts alongside
//! the main game using the shared fixture, then exercise a boost activation /
//! expiry flow and a collectible transfer flow. Ledger time is advanced
//! explicitly so the tests stay deterministic.

use soroban_sdk::{testutils::{Address as _, Ledger}, Address, Env};

use crate::fixture::{self, TestFixture};

/// Activates a boost, asserts the effect is visible through the game contract,
/// then advances ledger time past the boost expiry and asserts the effect is
/// gone.
#[test]
fn boost_activation_and_expiry_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let fixture = TestFixture::new(&env);
    let player = Address::generate(&env);

    // Deploy the boost-system contract alongside the main game.
    let boost = fixture.deploy_boost_system(&env);

    // Activate a short-lived boost for the player.
    let duration: u64 = 100;
    let multiplier: u32 = 2;
    boost.activate_boost(&player, &multiplier, &duration);

    // The effect should be visible through the game contract while active.
    let active_multiplier = fixture.game().get_boost_multiplier(&player);
    assert_eq!(active_multiplier, multiplier);

    // Advance ledger time past the boost expiry.
    let now = env.ledger().timestamp();
    env.ledger().set_timestamp(now + duration + 1);

    // The effect should be gone once the boost has expired.
    let expired_multiplier = fixture.game().get_boost_multiplier(&player);
    assert_eq!(expired_multiplier, 1);
}

/// Transfers a collectible from one account to another and asserts ownership
/// moved to the recipient.
#[test]
fn collectible_transfer_flow() {
    let env = Env::default();
    env.mock_all_auths();

    let fixture = TestFixture::new(&env);
    let owner = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Deploy the collectibles contract alongside the main game.
    let collectibles = fixture.deploy_collectibles(&env);

    // Mint a collectible to the original owner.
    let token_id = collectibles.mint(&owner);
    assert_eq!(collectibles.owner_of(&token_id), owner);

    // Transfer the collectible to the recipient.
    collectibles.transfer(&owner, &recipient, &token_id);

    // Ownership should have moved to the recipient.
    assert_eq!(collectibles.owner_of(&token_id), recipient);
}
