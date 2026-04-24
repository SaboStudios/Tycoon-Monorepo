/// # Transfer function — unit coverage (SW-CT-014)
///
/// Covers the `transfer` entry point and the remaining unit gaps not addressed
/// by `test.rs` or `overflow_rounding_tests.rs`.
///
/// | Test | What it pins |
/// |------|--------------|
/// | `transfer_basic`                        | happy-path: balance moves from sender to receiver |
/// | `transfer_insufficient_balance_panics`  | sender has less than requested amount |
/// | `transfer_zero_amount_is_noop`          | amount=0 does not change balances |
/// | `transfer_to_self_preserves_balance`    | from == to: net balance unchanged |
/// | `transfer_blocked_when_paused`          | paused contract rejects transfer |
/// | `transfer_updates_owned_token_count`    | count decrements on sender, increments on receiver |
/// | `transfer_full_balance_zeroes_sender`   | sender count drops to 0 after full transfer |
/// | `get_backend_minter_none_when_unset`    | returns None before set_backend_minter is called |
extern crate std;

use crate::{TycoonRewardSystem, TycoonRewardSystemClient};
use soroban_sdk::testutils::Address as _;
use soroban_sdk::{Address, Env};

// ── Harness ───────────────────────────────────────────────────────────────────

struct H<'a> {
    env: Env,
    client: TycoonRewardSystemClient<'a>,
    admin: Address,
    contract_id: Address,
}

impl<'a> H<'a> {
    fn new() -> Self {
        let env = Env::default();
        env.mock_all_auths();
        let admin = Address::generate(&env);
        let tyc_admin = Address::generate(&env);
        let tyc_id = env
            .register_stellar_asset_contract_v2(tyc_admin)
            .address();
        let usdc_admin = Address::generate(&env);
        let usdc_id = env
            .register_stellar_asset_contract_v2(usdc_admin)
            .address();
        let contract_id = env.register(TycoonRewardSystem, ());
        let client = TycoonRewardSystemClient::new(&env, &contract_id);
        client.initialize(&admin, &tyc_id, &usdc_id);
        H { env, client, admin, contract_id }
    }

    /// Mint a voucher directly via test_mint (bypasses admin check, token_id explicit).
    fn mint_raw(&self, to: &Address, token_id: u128, amount: u64) {
        self.client.test_mint(to, &token_id, &amount);
    }
}

// ── Transfer unit tests ───────────────────────────────────────────────────────

#[test]
fn transfer_basic() {
    let h = H::new();
    let sender = Address::generate(&h.env);
    let receiver = Address::generate(&h.env);
    let token_id: u128 = 1_000_000_001;

    h.mint_raw(&sender, token_id, 3);
    h.client.transfer(&sender, &receiver, &token_id, &2);

    assert_eq!(h.client.get_balance(&sender, &token_id), 1);
    assert_eq!(h.client.get_balance(&receiver, &token_id), 2);
}

#[test]
fn transfer_insufficient_balance_panics() {
    let h = H::new();
    let sender = Address::generate(&h.env);
    let receiver = Address::generate(&h.env);
    let token_id: u128 = 1_000_000_002;

    h.mint_raw(&sender, token_id, 1);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.transfer(&sender, &receiver, &token_id, &2); // 2 > 1
    }));
    assert!(res.is_err(), "transfer exceeding balance must panic");
}

#[test]
fn transfer_zero_amount_is_noop() {
    let h = H::new();
    let sender = Address::generate(&h.env);
    let receiver = Address::generate(&h.env);
    let token_id: u128 = 1_000_000_003;

    h.mint_raw(&sender, token_id, 5);
    h.client.transfer(&sender, &receiver, &token_id, &0);

    assert_eq!(h.client.get_balance(&sender, &token_id), 5);
    assert_eq!(h.client.get_balance(&receiver, &token_id), 0);
}

#[test]
fn transfer_to_self_preserves_balance() {
    let h = H::new();
    let user = Address::generate(&h.env);
    let token_id: u128 = 1_000_000_004;

    h.mint_raw(&user, token_id, 4);
    h.client.transfer(&user, &user, &token_id, &4);

    // Net balance unchanged: _burn then _mint with same address
    assert_eq!(h.client.get_balance(&user, &token_id), 4);
}

#[test]
fn transfer_blocked_when_paused() {
    let h = H::new();
    let sender = Address::generate(&h.env);
    let receiver = Address::generate(&h.env);
    let token_id: u128 = 1_000_000_005;

    h.mint_raw(&sender, token_id, 2);
    h.client.pause();

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        h.client.transfer(&sender, &receiver, &token_id, &1);
    }));
    assert!(res.is_err(), "transfer must be blocked when paused");

    // Unpause and verify transfer works again
    h.client.unpause();
    h.client.transfer(&sender, &receiver, &token_id, &1);
    assert_eq!(h.client.get_balance(&receiver, &token_id), 1);
}

#[test]
fn transfer_updates_owned_token_count() {
    let h = H::new();
    let sender = Address::generate(&h.env);
    let receiver = Address::generate(&h.env);
    let token_id: u128 = 1_000_000_006;

    h.mint_raw(&sender, token_id, 1);
    assert_eq!(h.client.owned_token_count(&sender), 1);
    assert_eq!(h.client.owned_token_count(&receiver), 0);

    h.client.transfer(&sender, &receiver, &token_id, &1);

    assert_eq!(h.client.owned_token_count(&sender), 0);
    assert_eq!(h.client.owned_token_count(&receiver), 1);
}

#[test]
fn transfer_full_balance_zeroes_sender() {
    let h = H::new();
    let sender = Address::generate(&h.env);
    let receiver = Address::generate(&h.env);
    let token_id: u128 = 1_000_000_007;

    h.mint_raw(&sender, token_id, 10);
    h.client.transfer(&sender, &receiver, &token_id, &10);

    assert_eq!(h.client.get_balance(&sender, &token_id), 0);
    assert_eq!(h.client.get_balance(&receiver, &token_id), 10);
    assert_eq!(h.client.owned_token_count(&sender), 0);
    assert_eq!(h.client.owned_token_count(&receiver), 1);
}

// ── Remaining unit gaps ───────────────────────────────────────────────────────

/// `get_backend_minter` returns `None` before `set_backend_minter` is called.
#[test]
fn get_backend_minter_none_when_unset() {
    let h = H::new();
    assert_eq!(h.client.get_backend_minter(), None);
}

/// `get_backend_minter` returns `None` after `clear_backend_minter`.
#[test]
fn get_backend_minter_none_after_clear() {
    let h = H::new();
    let minter = Address::generate(&h.env);
    h.client.set_backend_minter(&h.admin, &minter);
    assert_eq!(h.client.get_backend_minter(), Some(minter));
    h.client.clear_backend_minter(&h.admin);
    assert_eq!(h.client.get_backend_minter(), None);
}

/// Admin can mint without a backend minter set (admin-only path).
#[test]
fn admin_mints_without_backend_minter() {
    let h = H::new();
    let user = Address::generate(&h.env);
    // No backend minter set — admin can still mint via mint_voucher
    let token_id = h.client.mint_voucher(&h.admin, &user, &1);
    assert_eq!(h.client.get_balance(&user, &token_id), 1);
}

/// Voucher start ID is at least 1_000_000_000 (VOUCHER_ID_START constant).
#[test]
fn voucher_id_starts_at_expected_offset() {
    let h = H::new();
    let user = Address::generate(&h.env);
    let first_id = h.client.mint_voucher(&h.admin, &user, &1);
    assert!(
        first_id >= 1_000_000_000,
        "voucher IDs must start at VOUCHER_ID_START (1_000_000_000), got {first_id}"
    );
}
