/// # Tycoon Token — Security Review Tests (SW-CON-TOKEN-001)
///
/// Covers items identified in the security review checklist not already
/// exercised by the existing test modules.
#[cfg(test)]
mod tests {
    use crate::{TycoonToken, TycoonTokenClient};
    use soroban_sdk::{
        testutils::{Address as _, Events, Ledger, LedgerInfo},
        Address, Env,
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

    // ── SEC-01: negative initial_supply rejected ──────────────────────────────

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

    // ── SEC-02: allowance expiry enforced in transfer_from ────────────────────

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

    // ── SEC-03: allowance expiry enforced in burn_from ────────────────────────

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

    // ── SEC-04: non-expired allowance still works ─────────────────────────────

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

    // ── SEC-05: expiration_ledger = 0 means no expiry ────────────────────────

    #[test]
    fn test_sec_05_zero_expiration_ledger_never_expires() {
        let (e, client, admin) = setup();
        let spender = Address::generate(&e);
        let recipient = Address::generate(&e);

        let amount: i128 = 1_000_000_000_000_000_000;
        client.approve(&admin, &spender, &amount, &0); // 0 = no expiry

        set_ledger_seq(&e, 1_000_000);
        client.transfer_from(&spender, &admin, &recipient, &amount);

        assert_eq!(client.balance(&recipient), amount);
    }

    // ── SEC-06: allowance() returns 0 for expired entry ──────────────────────

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

    // ── SEC-07: set_admin emits SetAdminEvent ─────────────────────────────────

    #[test]
    fn test_sec_07_set_admin_emits_event() {
        let (e, client, _) = setup();
        let new_admin = Address::generate(&e);

        client.set_admin(&new_admin);

        let events = e.events().all();
        assert!(!events.is_empty(), "expected SetAdminEvent after set_admin");
    }

    // ── SEC-08: admin rotation is atomic ─────────────────────────────────────

    #[test]
    fn test_sec_08_old_admin_loses_rights_after_rotation() {
        let (e, client, old_admin) = setup();
        let new_admin = Address::generate(&e);
        client.set_admin(&new_admin);
        assert_eq!(client.admin(), new_admin);
        assert_ne!(client.admin(), old_admin);
    }

    // ── SEC-09: allowance expiry boundary (expiration_ledger == current) ──────

    /// Allowance with expiration_ledger == current ledger is still valid (strict >).
    #[test]
    fn test_sec_09_allowance_valid_at_exact_expiry_ledger() {
        let e = Env::default();
        e.mock_all_auths();
        let id = e.register(TycoonToken, ());
        let client = TycoonTokenClient::new(&e, &id);
        let admin = Address::generate(&e);
        let spender = Address::generate(&e);
        let recipient = Address::generate(&e);
        client.initialize(&admin, &INITIAL_SUPPLY);

        let amount: i128 = 1_000_000_000_000_000_000;
        client.approve(&admin, &spender, &amount, &10);
        set_ledger_seq(&e, 10); // exactly at expiry — still valid
        client.transfer_from(&spender, &admin, &recipient, &amount);
        assert_eq!(client.balance(&recipient), amount);
    }

    /// Allowance is expired one ledger past expiration_ledger.
    #[test]
    #[should_panic(expected = "Allowance expired")]
    fn test_sec_09b_allowance_expired_one_past_expiry() {
        let e = Env::default();
        e.mock_all_auths();
        let id = e.register(TycoonToken, ());
        let client = TycoonTokenClient::new(&e, &id);
        let admin = Address::generate(&e);
        let spender = Address::generate(&e);
        let recipient = Address::generate(&e);
        client.initialize(&admin, &INITIAL_SUPPLY);

        client.approve(&admin, &spender, &1_000_000_000_000_000_000, &10);
        set_ledger_seq(&e, 11); // one past expiry
        client.transfer_from(&spender, &admin, &recipient, &1_000_000_000_000_000_000);
    }

    // ── SEC-10: double-initialize rejected ────────────────────────────────────

    #[test]
    #[should_panic(expected = "Already initialized")]
    fn test_sec_10_double_initialize_rejected() {
        let (_e, client, admin) = setup();
        client.initialize(&admin, &INITIAL_SUPPLY);
    }

    // ── SEC-11: legacy entrypoints panic with deprecation message ─────────────

    #[test]
    #[should_panic(expected = "legacy_mint is deprecated")]
    fn test_sec_11a_legacy_mint_panics() {
        let (e, client, _) = setup();
        let user = Address::generate(&e);
        client.legacy_mint(&user, &1);
    }

    #[test]
    #[should_panic(expected = "legacy_burn is deprecated")]
    fn test_sec_11b_legacy_burn_panics() {
        let (_e, client, admin) = setup();
        client.legacy_burn(&admin, &1);
    }

    #[test]
    #[should_panic(expected = "legacy_transfer is deprecated")]
    fn test_sec_11c_legacy_transfer_panics() {
        let (e, client, admin) = setup();
        let user = Address::generate(&e);
        client.legacy_transfer(&admin, &user, &1);
    }

    // ── SEC-12: transfer_from / burn_from with zero allowance rejected ─────────

    #[test]
    #[should_panic(expected = "Insufficient allowance")]
    fn test_sec_12a_transfer_from_zero_allowance_rejected() {
        let (e, client, admin) = setup();
        let spender = Address::generate(&e);
        let recipient = Address::generate(&e);
        client.transfer_from(&spender, &admin, &recipient, &1);
    }

    #[test]
    #[should_panic(expected = "Insufficient allowance")]
    fn test_sec_12b_burn_from_zero_allowance_rejected() {
        let (e, client, admin) = setup();
        let spender = Address::generate(&e);
        client.burn_from(&spender, &admin, &1);
    }

    // ── SEC-13: supply overflow guard ─────────────────────────────────────────

    #[test]
    #[should_panic(expected = "Supply overflow")]
    fn test_sec_13_mint_supply_overflow_rejected() {
        let (_, client, _) = setup();
        let user = Address::generate(&client.env);
        let overflow_amount = i128::MAX - INITIAL_SUPPLY + 1;
        client.mint(&user, &overflow_amount);
    }
}
