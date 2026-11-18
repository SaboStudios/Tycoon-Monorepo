#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const VOUCHER_ID_START: u128 = 1_000_000_000;

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    // (Owner, TokenID) -> Amount
    Balance(Address, u128),
    // TokenID -> Value
    VoucherValue(u128),
    // TokenID -> Perk Enum (u32)
    CollectiblePerk(u128),
    // TokenID -> Strength
    CollectibleStrength(u128),
    // TokenID -> Price
    CollectibleTyc(u128),
    CollectibleUsdc(u128),
    Admin,
    TycToken,
    UsdcToken,
    VoucherCount,
    Paused,
    // Backend minter address (optional - None if not set)
    BackendMinter,
    // (Owner) -> Total distinct vouchers owned
    OwnedTokenCount(Address),
    StateVersion,
}

#[contract]
pub struct TycoonRewardSystem;

#[contractimpl]
impl TycoonRewardSystem {
    pub fn initialize(e: Env, admin: Address, tyc_token: Address, usdc_token: Address) {
        if e.storage().persistent().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        // Batch all initialization writes together
        e.storage().persistent().set(&DataKey::Admin, &admin);
        e.storage().persistent().set(&DataKey::TycToken, &tyc_token);
        e.storage().persistent().set(&DataKey::UsdcToken, &usdc_token);
        e.storage().persistent().set(&DataKey::VoucherCount, &VOUCHER_ID_START);
        e.storage().persistent().set(&DataKey::Paused, &false);
        e.storage().persistent().set(&DataKey::StateVersion, &1u32);
    }

    /// Migrate the contract to a newer state version (admin only)
    pub fn migrate(e: Env) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();

        let current_version: u32 = e
            .storage()
            .persistent()
            .get(&DataKey::StateVersion)
            .unwrap_or(0);

        if current_version == 0 {
            e.storage().persistent().set(&DataKey::StateVersion, &1u32);
        }
    }

    /// Emergency pause contract (admin only)
    pub fn pause(e: Env) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();
        e.storage().persistent().set(&DataKey::Paused, &true);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("Paused"),), true);
    }

    /// Emergency unpause contract (admin only)
    pub fn unpause(e: Env) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();
        e.storage().persistent().set(&DataKey::Paused, &false);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("Unpaused"),), false);
    }

    /// Set the backend minter address (admin only)
    pub fn set_backend_minter(e: Env, admin: Address, new_minter: Address) {
        let stored_admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        if admin != stored_admin {
            panic!("Unauthorized: only admin can set backend minter");
        }
        admin.require_auth();
        e.storage().persistent().set(&DataKey::BackendMinter, &new_minter);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("set_min"), new_minter), ());
    }

    /// Clear the backend minter address (admin only)
    pub fn clear_backend_minter(e: Env, admin: Address) {
        let stored_admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        if admin != stored_admin {
            panic!("Unauthorized: only admin can clear backend minter");
        }
        admin.require_auth();
        e.storage().persistent().remove(&DataKey::BackendMinter);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("clr_min"),), ());
    }

    /// Get the current backend minter address. Returns None if not set.
    pub fn get_backend_minter(e: Env) -> Option<Address> {
        // Single read — avoids the has() + get() double-read pattern
        e.storage().persistent().get(&DataKey::BackendMinter)
    }

    pub fn mint_voucher(e: Env, caller: Address, to: Address, tyc_value: u128) -> u128 {
        // Single read for admin — reused for both auth check and comparison
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        caller.require_auth();

        // Single read for BackendMinter — replaces has() + get() double-read
        let backend_minter: Option<Address> =
            e.storage().persistent().get(&DataKey::BackendMinter);

        let is_authorized = caller == admin
            || backend_minter.map_or(false, |m| m == caller);

        if !is_authorized {
            panic!("Unauthorized: only admin or backend minter can mint");
        }

        // Read-increment-write in one block; no intermediate clone needed
        let token_id: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherCount)
            .unwrap_or(VOUCHER_ID_START);
        e.storage()
            .persistent()
            .set(&DataKey::VoucherCount, &(token_id + 1));

        e.storage()
            .persistent()
            .set(&DataKey::VoucherValue(token_id), &tyc_value);

        // _mint emits its own "Mint" event; no extra event needed here
        Self::_mint(&e, to.clone(), token_id, 1);

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("V_Mint"), to, token_id), tyc_value);

        token_id
    }

    pub fn redeem_voucher(_e: Env, _token_id: u128) {
        panic!("Use redeem_voucher_from instead");
    }

    pub fn redeem_voucher_from(e: Env, redeemer: Address, token_id: u128) {
        redeemer.require_auth();

        // Single read for Paused — unwrap_or avoids a separate has() check
        if e.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Paused)
            .unwrap_or(false)
        {
            panic!("Contract is paused");
        }

        let tyc_value: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherValue(token_id))
            .expect("Invalid token_id");

        // Burn first (validates balance), then transfer
        Self::_burn(&e, redeemer.clone(), token_id, 1);

        let tyc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::TycToken)
            .expect("Not initialized");

        soroban_sdk::token::Client::new(&e, &tyc_token).transfer(
            &e.current_contract_address(),
            &redeemer,
            &(tyc_value as i128),
        );

        // Remove voucher value entry after successful transfer
        e.storage().persistent().remove(&DataKey::VoucherValue(token_id));

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Redeem"), redeemer, token_id), tyc_value);
    }

    /// Withdraw funds from the contract (admin only)
    pub fn withdraw_funds(e: Env, token: Address, to: Address, amount: u128) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();

        // Read both token addresses in two reads (unavoidable), but reuse locals
        let tyc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::TycToken)
            .expect("Not initialized");
        let usdc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::UsdcToken)
            .expect("Not initi

/* … truncated 5234 chars — edit only what you need near the top … */
