/// SW-CT-006 — tycoon-token: formalize admin-only vs public entrypoints
///
/// Admin-only entrypoints (guarded by `require_admin`): `mint`, `set_admin`
/// Public entrypoints (caller self-authenticates): `transfer`, `transfer_from`,
///   `burn`, `burn_from`, `approve`
/// Read-only / unauthenticated: `balance`, `allowance`, `total_supply`,
///   `decimals`, `name`, `symbol`
extern crate std;

use crate::TycoonToken;
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    vec, Address, Env, IntoVal,
};

const SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000;

// ---------------------------------------------------------------------------
// Admin-only: mint
// ---------------------------------------------------------------------------

#[test]
fn admin_can_mint() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let amount: i128 = 1_000_000_000_000_000_000_000;
    client.mint(&user, &amount);
    assert_eq!(client.balance(&user), amount);
    assert_eq!(client.total_supply(), SUPPLY + amount);
}

#[test]
#[should_panic]
fn non_admin_cannot_mint() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    // Provide auth only for attacker — admin.require_auth() inside mint will fail.
    e.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "mint",
            args: vec![&e, attacker.clone().into_val(&e), 1_i128.into_val(&e)],
            sub_invokes: &[],
        },
    }]);
    client.mint(&attacker, &1);
}

#[test]
fn non_admin_mint_does_not_change_supply() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let supply_before = client.total_supply();

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        e.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &id,
                fn_name: "mint",
                args: vec![&e, attacker.clone().into_val(&e), 1_i128.into_val(&e)],
                sub_invokes: &[],
            },
        }]);
        client.mint(&attacker, &1);
    }));

    assert!(res.is_err());
    assert_eq!(client.total_supply(), supply_before);
}

// ---------------------------------------------------------------------------
// Admin-only: set_admin
// ---------------------------------------------------------------------------

#[test]
fn admin_can_set_admin() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let new_admin = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

#[test]
#[should_panic]
fn non_admin_cannot_set_admin() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    e.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "set_admin",
            args: vec![&e, attacker.clone().into_val(&e)],
            sub_invokes: &[],
        },
    }]);
    client.set_admin(&attacker);
}

#[test]
fn non_admin_set_admin_does_not_change_admin() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let res = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        e.mock_auths(&[MockAuth {
            address: &attacker,
            invoke: &MockAuthInvoke {
                contract: &id,
                fn_name: "set_admin",
                args: vec![&e, attacker.clone().into_val(&e)],
                sub_invokes: &[],
            },
        }]);
        client.set_admin(&attacker);
    }));

    assert!(res.is_err());
    assert_eq!(client.admin(), admin);
}

// ---------------------------------------------------------------------------
// Public: transfer (caller self-authenticates)
// ---------------------------------------------------------------------------

#[test]
fn token_holder_can_transfer() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    let amount: i128 = 100_000_000_000_000_000_000_000_000;
    client.transfer(&admin, &user, &amount);
    assert_eq!(client.balance(&user), amount);
    assert_eq!(client.balance(&admin), SUPPLY - amount);
}

#[test]
#[should_panic]
fn third_party_cannot_transfer_without_allowance() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    let attacker = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    // Attacker provides their own auth but tries to move admin's tokens.
    e.mock_auths(&[MockAuth {
        address: &attacker,
        invoke: &MockAuthInvoke {
            contract: &id,
            fn_name: "transfer",
            args: vec![
                &e,
                admin.clone().into_val(&e),
                attacker.clone().into_val(&e),
                1_i128.into_val(&e),
            ],
            sub_invokes: &[],
        },
    }]);
    client.transfer(&admin, &attacker, &1);
}

// ---------------------------------------------------------------------------
// Read-only: no auth required
// ---------------------------------------------------------------------------

#[test]
fn read_only_entrypoints_need_no_auth() {
    let e = Env::default();
    e.mock_all_auths();
    let id = e.register(TycoonToken, ());
    let client = crate::TycoonTokenClient::new(&e, &id);
    let admin = Address::generate(&e);
    client.initialize(&admin, &SUPPLY);

    // Clear all auth mocks — read-only calls must succeed without any auth.
    e.mock_auths(&[]);

    assert_eq!(client.total_supply(), SUPPLY);
    assert_eq!(client.balance(&admin), SUPPLY);
    assert_eq!(client.decimals(), 18);
    assert_eq!(client.name(), soroban_sdk::String::from_str(&e, "Tycoon"));
    assert_eq!(client.symbol(), soroban_sdk::String::from_str(&e, "TYC"));
    assert_eq!(client.allowance(&admin, &admin), 0);
}
