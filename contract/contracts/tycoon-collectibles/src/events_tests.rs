#![cfg(test)]
//! SW-CT-EVT-001: Event-emission coverage tests for tycoon-collectibles events.rs
//!
//! Each test drives the contract through a code path that calls one of the
//! event emitters in `events.rs`, then inspects the emitted event topic and
//! data to verify correctness.
//!
//! Emitters covered:
//!   emit_transfer_event
//!   emit_collectible_burned_event
//!   emit_cash_perk_activated_event
//!   emit_collectible_bought_event
//!   emit_collectible_stocked_event
//!   emit_collectible_restocked_event
//!   emit_price_updated_event
//!   emit_collectible_minted_event
//!   emit_fee_distributed_event
//!   emit_perk_activated_event  (non-cash perks: RentBoost, ExtraTurn, JailFree,
//!                                DoubleRent, RollBoost, Teleport, Shield,
//!                                PropertyDiscount, RollExact)

extern crate std;

use crate::{TycoonCollectibles, TycoonCollectiblesClient};
use soroban_sdk::{
    symbol_short,
    testutils::{Address as _, Events},
    token::StellarAssetClient,
    Address, Env, IntoVal,
};

// ── helpers ───────────────────────────────────────────────────────────────────

fn setup(env: &Env) -> (TycoonCollectiblesClient<'_>, Address, Address) {
    let contract_id = env.register(TycoonCollectibles, ());
    let client = TycoonCollectiblesClient::new(env, &contract_id);
    let admin = Address::generate(env);
    client.initialize(&admin);
    (client, admin, contract_id)
}

fn make_token(env: &Env, admin: &Address) -> Address {
    env.register_stellar_asset_contract_v2(admin.clone())
        .address()
}

// ── emit_transfer_event ───────────────────────────────────────────────────────

#[test]
fn test_transfer_event_emitted_on_transfer() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    client.buy_collectible(&alice, &1, &5);

    // Clear setup events; track only transfer events from here
    let _ = env.events().all();

    client.transfer(&alice, &bob, &1, &3);

    let events = env.events().all();
    // Find the transfer event by topic keyword
    let transfer_event = events
        .iter()
        .find(|(_, topic, _)| topic == &(symbol_short!("transfer"), alice.clone(), bob.clone()).into_val(&env));

    assert!(
        transfer_event.is_some(),
        "transfer event must be emitted on transfer"
    );
}

#[test]
fn test_transfer_event_data_contains_token_id_and_amount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    client.buy_collectible(&alice, &42, &10);

    client.transfer(&alice, &bob, &42, &7);

    let events = env.events().all();
    let transfer_event = events
        .iter()
        .find(|(_, topic, _)| topic == &(symbol_short!("transfer"), alice.clone(), bob.clone()).into_val(&env));

    assert!(transfer_event.is_some());
    let (_, _, data) = transfer_event.unwrap();
    // data is (token_id: u128, amount: u64)
    let (emitted_token_id, emitted_amount): (u128, u64) =
        soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(emitted_token_id, 42);
    assert_eq!(emitted_amount, 7);
}

// ── emit_collectible_stocked_event ────────────────────────────────────────────

#[test]
fn test_stocked_event_emitted_on_stock_shop() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    client.stock_shop(&10, &1, &3, &1000, &500);

    let events = env.events().all();
    let stocked = events
        .iter()
        .find(|(_, topic, _)| {
            topic
                == &(symbol_short!("stock"), symbol_short!("new")).into_val(&env)
        });
    assert!(stocked.is_some(), "stocked event must be emitted");
}

#[test]
fn test_stocked_event_data_matches_inputs() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let token_id = client.stock_shop(&10, &1, &3, &1000, &500);

    let events = env.events().all();
    let stocked = events
        .iter()
        .find(|(_, topic, _)| {
            topic == &(symbol_short!("stock"), symbol_short!("new")).into_val(&env)
        })
        .unwrap();

    let (_, _, data) = stocked;
    // data: (token_id, amount, perk, strength, tyc_price, usdc_price)
    let (eid, eamt, eperk, estr, etyc, eusdc): (u128, u64, u32, u32, u128, u128) =
        soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(eid, token_id);
    assert_eq!(eamt, 10);
    assert_eq!(eperk, 1);
    assert_eq!(estr, 3);
    assert_eq!(etyc, 1000);
    assert_eq!(eusdc, 500);
}

// ── emit_collectible_restocked_event ─────────────────────────────────────────

#[test]
fn test_restocked_event_emitted() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let token_id = client.stock_shop(&20, &1, &2, &100, &0);
    client.restock_collectible(&token_id, &5);

    let events = env.events().all();
    let restocked = events
        .iter()
        .find(|(_, topic, _)| topic == &(symbol_short!("restock"),).into_val(&env));
    assert!(restocked.is_some(), "restock event must be emitted");
}

#[test]
fn test_restocked_event_data_contains_new_total() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let token_id = client.stock_shop(&20, &1, &2, &100, &0);
    client.restock_collectible(&token_id, &5);

    let events = env.events().all();
    let restocked = events
        .iter()
        .find(|(_, topic, _)| topic == &(symbol_short!("restock"),).into_val(&env))
        .unwrap();

    let (_, _, data) = restocked;
    // data: (token_id, additional_amount, new_total)
    let (eid, eadd, etotal): (u128, u64, u64) = soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(eid, token_id);
    assert_eq!(eadd, 5);
    assert_eq!(etotal, 25);
}

// ── emit_price_updated_event ──────────────────────────────────────────────────

#[test]
fn test_price_updated_event_emitted() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let token_id = client.stock_shop(&5, &1, &1, &1000, &200);
    client.update_collectible_prices(&token_id, &500, &100);

    let events = env.events().all();
    let price_ev = events
        .iter()
        .find(|(_, topic, _)| {
            topic
                == &(symbol_short!("price"), symbol_short!("update")).into_val(&env)
        });
    assert!(price_ev.is_some(), "price_updated event must be emitted");
}

#[test]
fn test_price_updated_event_data() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let token_id = client.stock_shop(&5, &1, &1, &1000, &200);
    client.update_collectible_prices(&token_id, &500, &100);

    let events = env.events().all();
    let price_ev = events
        .iter()
        .find(|(_, topic, _)| {
            topic == &(symbol_short!("price"), symbol_short!("update")).into_val(&env)
        })
        .unwrap();

    let (_, _, data) = price_ev;
    // data: (token_id, new_tyc_price, new_usdc_price)
    let (eid, etyc, eusdc): (u128, u128, u128) = soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(eid, token_id);
    assert_eq!(etyc, 500);
    assert_eq!(eusdc, 100);
}

// ── emit_collectible_bought_event ─────────────────────────────────────────────

#[test]
fn test_bought_event_emitted_on_buy() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);
    let token_id = client.stock_shop(&5, &3, &1, &200, &0);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);

    let events = env.events().all();
    let bought = events
        .iter()
        .find(|(_, topic, _)| topic == &(symbol_short!("coll_buy"), buyer.clone()).into_val(&env));
    assert!(bought.is_some(), "coll_buy event must be emitted");
}

#[test]
fn test_bought_event_data() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);
    let token_id = client.stock_shop(&5, &3, &1, &200, &0);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &1000);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);

    let events = env.events().all();
    let bought = events
        .iter()
        .find(|(_, topic, _)| topic == &(symbol_short!("coll_buy"), buyer.clone()).into_val(&env))
        .unwrap();

    let (_, _, data) = bought;
    // data: (token_id, price, use_usdc)
    let (eid, eprice, eusdc): (u128, i128, bool) = soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(eid, token_id);
    assert_eq!(eprice, 200);
    assert!(!eusdc);
}

// ── emit_collectible_burned_event ─────────────────────────────────────────────

#[test]
fn test_burned_event_emitted_on_burn_for_perk() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &3);
    client.set_token_perk(&1, &crate::types::Perk::RentBoost, &1);

    client.burn_collectible_for_perk(&user, &1);

    let events = env.events().all();
    let burned = events.iter().find(|(_, topic, _)| {
        topic
            == &(
                symbol_short!("burn"),
                symbol_short!("coll"),
                user.clone(),
            )
                .into_val(&env)
    });
    assert!(burned.is_some(), "burn event must be emitted");
}

// ── emit_cash_perk_activated_event ────────────────────────────────────────────

#[test]
fn test_cash_perk_event_emitted_for_cash_tiered() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &1);
    client.set_token_perk(&1, &crate::types::Perk::CashTiered, &3);

    client.burn_collectible_for_perk(&user, &1);

    let events = env.events().all();
    let cash_ev = events.iter().find(|(_, topic, _)| {
        topic
            == &(
                symbol_short!("perk"),
                symbol_short!("cash"),
                user.clone(),
            )
                .into_val(&env)
    });
    assert!(
        cash_ev.is_some(),
        "cash perk activation event must be emitted for CashTiered"
    );
}

#[test]
fn test_cash_perk_event_data_contains_cash_value() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &1);
    // Strength 3 → CASH_TIERS[2] = 500
    client.set_token_perk(&1, &crate::types::Perk::CashTiered, &3);

    client.burn_collectible_for_perk(&user, &1);

    let events = env.events().all();
    let cash_ev = events
        .iter()
        .find(|(_, topic, _)| {
            topic
                == &(
                    symbol_short!("perk"),
                    symbol_short!("cash"),
                    user.clone(),
                )
                    .into_val(&env)
        })
        .unwrap();

    let (_, _, data) = cash_ev;
    // data: (token_id, cash_value)
    let (eid, ecash): (u128, i128) = soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(eid, 1);
    assert_eq!(ecash, 500);
}

#[test]
fn test_cash_perk_event_emitted_for_tax_refund() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &1);
    client.set_token_perk(&1, &crate::types::Perk::TaxRefund, &2);

    client.burn_collectible_for_perk(&user, &1);

    let events = env.events().all();
    let cash_ev = events.iter().find(|(_, topic, _)| {
        topic
            == &(
                symbol_short!("perk"),
                symbol_short!("cash"),
                user.clone(),
            )
                .into_val(&env)
    });
    assert!(
        cash_ev.is_some(),
        "cash perk activation event must be emitted for TaxRefund"
    );
}

// ── emit_perk_activated_event (non-cash perks) ────────────────────────────────

fn check_perk_activate_event(env: &Env, user: &Address) {
    let events = env.events().all();
    let perk_ev = events.iter().find(|(_, topic, _)| {
        topic
            == &(
                symbol_short!("perk"),
                symbol_short!("activate"),
                user.clone(),
            )
                .into_val(env)
    });
    assert!(
        perk_ev.is_some(),
        "perk activate event must be emitted for non-cash perk"
    );
}

#[test]
fn test_perk_activate_event_rent_boost() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &1, &1);
    client.set_token_perk(&1, &crate::types::Perk::RentBoost, &1);
    client.burn_collectible_for_perk(&user, &1);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_extra_turn() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &2, &1);
    client.set_token_perk(&2, &crate::types::Perk::ExtraTurn, &1);
    client.burn_collectible_for_perk(&user, &2);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_jail_free() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &3, &1);
    client.set_token_perk(&3, &crate::types::Perk::JailFree, &1);
    client.burn_collectible_for_perk(&user, &3);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_double_rent() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &4, &1);
    client.set_token_perk(&4, &crate::types::Perk::DoubleRent, &1);
    client.burn_collectible_for_perk(&user, &4);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_roll_boost() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &5, &1);
    client.set_token_perk(&5, &crate::types::Perk::RollBoost, &2);
    client.burn_collectible_for_perk(&user, &5);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_teleport() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &6, &1);
    client.set_token_perk(&6, &crate::types::Perk::Teleport, &1);
    client.burn_collectible_for_perk(&user, &6);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_shield() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &7, &1);
    client.set_token_perk(&7, &crate::types::Perk::Shield, &1);
    client.burn_collectible_for_perk(&user, &7);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_property_discount() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &8, &1);
    client.set_token_perk(&8, &crate::types::Perk::PropertyDiscount, &2);
    client.burn_collectible_for_perk(&user, &8);
    check_perk_activate_event(&env, &user);
}

#[test]
fn test_perk_activate_event_roll_exact() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);
    client.buy_collectible(&user, &9, &1);
    client.set_token_perk(&9, &crate::types::Perk::RollExact, &1);
    client.burn_collectible_for_perk(&user, &9);
    check_perk_activate_event(&env, &user);
}

// ── emit_collectible_minted_event ─────────────────────────────────────────────

#[test]
fn test_minted_event_emitted_on_mint_collectible() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let recipient = Address::generate(&env);
    let token_id = client.mint_collectible(&admin, &recipient, &1, &2);

    let events = env.events().all();
    let minted = events.iter().find(|(_, topic, _)| {
        topic == &(symbol_short!("coll_mint"), recipient.clone()).into_val(&env)
    });
    assert!(minted.is_some(), "coll_mint event must be emitted");
    let (_, _, data) = minted.unwrap();
    let (eid, eperk, estr): (u128, u32, u32) = soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(eid, token_id);
    assert_eq!(eperk, 1);
    assert_eq!(estr, 2);
}

// ── emit_fee_distributed_event ────────────────────────────────────────────────

#[test]
fn test_fee_distributed_event_emitted_on_buy_with_fee_config() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, admin, _) = setup(&env);

    let tyc_token = make_token(&env, &admin);
    let usdc_token = make_token(&env, &admin);
    client.init_shop(&tyc_token, &usdc_token);

    let platform = Address::generate(&env);
    let pool = Address::generate(&env);
    // 10% platform, 5% creator, 5% pool
    client.set_fee_config(&1000, &500, &500, &platform, &pool);

    let token_id = client.stock_shop(&5, &3, &1, &1000, &0);

    let buyer = Address::generate(&env);
    StellarAssetClient::new(&env, &tyc_token).mint(&buyer, &5000);

    client.buy_collectible_from_shop(&buyer, &token_id, &false);

    let events = env.events().all();
    let fee_ev = events
        .iter()
        .find(|(_, topic, _)| topic == &(symbol_short!("fee_dist"), token_id).into_val(&env));
    assert!(
        fee_ev.is_some(),
        "fee_distributed event must be emitted when fee config is set"
    );
}

// ── backend_minter set event ──────────────────────────────────────────────────

#[test]
fn test_set_backend_minter_event_topic_and_data() {
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);

    let minter = Address::generate(&env);
    client.set_backend_minter(&minter);

    let events = env.events().all();
    let minter_ev = events.iter().find(|(_, topic, _)| {
        topic == &(symbol_short!("minter"), symbol_short!("set")).into_val(&env)
    });
    assert!(minter_ev.is_some(), "minter set event must be emitted");

    let (_, _, data) = minter_ev.unwrap();
    let emitted: Address = soroban_sdk::FromVal::from_val(&env, &data);
    assert_eq!(emitted, minter);
}

// ── no spurious events after read-only calls ──────────────────────────────────

#[test]
fn test_read_only_calls_emit_no_events() {
    // `env.events().all()` drains the event queue.
    // After draining it, only read-only calls follow — no new events should
    // appear in the queue.
    let env = Env::default();
    env.mock_all_auths();
    let (client, _, _) = setup(&env);
    let user = Address::generate(&env);

    // Mutable call produces an event; drain the queue to clear it.
    client.buy_collectible(&user, &1, &1);
    let _ = env.events().all(); // drain

    // Only invoke read-only contract functions after the drain
    let _ = client.balance_of(&user, &1);
    let _ = client.tokens_of(&user);
    let _ = client.owned_token_count(&user);
    let _ = client.get_token_perk(&1);
    let _ = client.get_token_strength(&1);
    let _ = client.is_contract_paused();
    let _ = client.max_page_size();

    // Queue must be empty — read-only calls emit no events
    assert_eq!(
        env.events().all().len(),
        0,
        "read-only calls must not emit events"
    );
}
