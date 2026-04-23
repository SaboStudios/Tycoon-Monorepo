/// # Tycoon Token — Security Review Tests (SW-CON-TOKEN-001)
///
/// Covers items identified in the security review checklist not already
/// exercised by the existing test modules.
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger, LedgerInfo},
    Env,
};

const INITIAL_SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000;

fn setup() -> (Env, TycoonTokenClient<'static>, Address) {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    client.initialize(&admin, &INITIAL_SUPPLY);
    (e, client, admin)
}

fn set_ledger_seq(e: &Env, seq: u32) {
    e.ledger().set(LedgerInfo {
        sequence_number: seq,
        timestamp: seq as u64 * 5,
        protocol_version: 23,
        network_id: Default::default(),
        base_reserve: 10,
        min_temp_entry_ttl: 1,
        min_persistent_entry_ttl: 1,
        max_entry_ttl: 6_312_000,
    });
}

// ── SEC-01: negative initial_supply rejected ──────────────────────────────────

#[test]
#[should_panic(expected = "Initial supply cannot be negative")]
fn test_sec_01_initialize_negative_supply_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    client.initialize(&admin, &-1);
}

// ── SEC-02: allowance expiry enforced in transfer_from ────────────────────────

#[test]
#[should_panic(expected = "Allowance expired")]
fn test_sec_02_transfer_from_expired_allowance_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.approve(&admin, &spender, &1_000_000_000_000_000_000, &10);

    set_ledger_seq(&e, 11); // past expiry
    client.transfer_from(&spender, &admin, &recipient, &1_000_000_000_000_000_000);
}

// ── SEC-03: allowance expiry enforced in burn_from ────────────────────────────

#[test]
#[should_panic(expected = "Allowance expired")]
fn test_sec_03_burn_from_expired_allowance_rejected() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.approve(&admin, &spender, &1_000_000_000_000_000_000, &10);

    set_ledger_seq(&e, 11);
    client.burn_from(&spender, &admin, &1_000_000_000_000_000_000);
}

// ── SEC-04: non-expired allowance still works ─────────────────────────────────

#[test]
fn test_sec_04_transfer_from_within_expiry_succeeds() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let amount: i128 = 1_000_000_000_000_000_000;
    client.approve(&admin, &spender, &amount, &100);

    set_ledger_seq(&e, 50); // within expiry
    client.transfer_from(&spender, &admin, &recipient, &amount);

    assert_eq!(client.balance(&recipient), amount);
}

// ── SEC-05: expiration_ledger = 0 means no expiry ────────────────────────────

#[test]
fn test_sec_05_zero_expiration_ledger_never_expires() {
    let (e, client, admin) = setup();
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    let amount: i128 = 1_000_000_000_000_000_000;
    client.approve(&admin, &spender, &amount, &0); // 0 = no expiry

    set_ledger_seq(&e, 1_000_000); // very far in the future, no expiry since expiration_ledger = 0
    client.transfer_from(&spender, &admin, &recipient, &amount);

    assert_eq!(client.balance(&recipient), amount);
}

// ── SEC-06: allowance() returns 0 for expired entry ──────────────────────────

#[test]
fn test_sec_06_allowance_returns_zero_after_expiry() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.approve(&admin, &spender, &1_000_000_000_000_000_000, &5);

    set_ledger_seq(&e, 6);
    assert_eq!(client.allowance(&admin, &spender), 0);
}

// ── SEC-07: set_admin emits SetAdminEvent ─────────────────────────────────────

#[test]
fn test_sec_07_set_admin_emits_event() {
    let (e, client, _) = setup();
    let new_admin = Address::generate(&e);

    client.set_admin(&new_admin);

    let events = e.events().all();
    assert!(!events.is_empty(), "expected SetAdminEvent after set_admin");
}
