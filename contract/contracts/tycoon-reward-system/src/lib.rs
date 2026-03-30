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
            .expect("Not initialized");

        if token != tyc_token && token != usdc_token {
            panic!("Invalid token: not in allowlist");
        }

        let token_client = soroban_sdk::token::Client::new(&e, &token);
        let contract_address = e.current_contract_address();

        if token_client.balance(&contract_address) < amount as i128 {
            panic!("Insufficient contract balance");
        }

        token_client.transfer(&contract_address, &to, &(amount as i128));

        #[allow(deprecated)]
        e.events()
            .publish((Symbol::new(&e, "FundsWithdrawn"), token.clone(), to), amount);
    }

    pub fn get_balance(e: Env, owner: Address, token_id: u128) -> u64 {
        Self::balance_of(&e, owner, token_id)
    }

    /// Get the number of distinct voucher tokens owned by an address
    pub fn owned_token_count(e: Env, owner: Address) -> u32 {
        e.storage()
            .persistent()
            .get(&DataKey::OwnedTokenCount(owner))
            .unwrap_or(0)
    }

    /// Transfer vouchers from one address to another
    pub fn transfer(e: Env, from: Address, to: Address, token_id: u128, amount: u64) {
        from.require_auth();

        if e.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Paused)
            .unwrap_or(false)
        {
            panic!("Contract is paused");
        }

        // _burn and _mint each emit their own internal events; the outer
        // "Transfer" event is the only caller-visible one needed here.
        Self::_burn(&e, from.clone(), token_id, amount);
        Self::_mint(&e, to.clone(), token_id, amount);

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Transfer"), from, to, token_id), amount);
    }
}

impl TycoonRewardSystem {
    /// Mint `amount` of `token_id` to `to`.
    ///
    /// Optimisations vs. original:
    /// - Single storage read for balance (no separate has() check).
    /// - OwnedTokenCount updated only when balance crosses zero → non-zero.
    /// - No redundant clone of `to` for the count key when balance > 0.
    fn _mint(e: &Env, to: Address, token_id: u128, amount: u64) {
        if amount == 0 {
            return;
        }
        let key = DataKey::Balance(to.clone(), token_id);
        let current_balance: u64 = e.storage().persistent().get(&key).unwrap_or(0);

        let new_balance = current_balance
            .checked_add(amount)
            .expect("Balance overflow");

        e.storage().persistent().set(&key, &new_balance);

        // Only touch OwnedTokenCount on the zero → non-zero transition
        if current_balance == 0 {
            let count_key = DataKey::OwnedTokenCount(to.clone());
            let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            e.storage().persistent().set(&count_key, &(count + 1));
        }

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Mint"), to, token_id), amount);
    }

    /// Burn `amount` of `token_id` from `from`.
    ///
    /// Optimisations vs. original:
    /// - Removes the balance entry entirely when it reaches zero (saves future
    ///   reads returning a default).
    /// - OwnedTokenCount updated only on the non-zero → zero transition.
    /// - Removes OwnedTokenCount entry when it reaches zero instead of writing 0.
    fn _burn(e: &Env, from: Address, token_id: u128, amount: u64) {
        if amount == 0 {
            return;
        }
        let key = DataKey::Balance(from.clone(), token_id);
        let current_balance: u64 = e.storage().persistent().get(&key).unwrap_or(0);

        if current_balance < amount {
            panic!("Insufficient balance");
        }

        let new_balance = current_balance - amount;

        if new_balance == 0 {
            // Remove entry — cheaper than writing a zero value
            e.storage().persistent().remove(&key);

            // Only touch OwnedTokenCount on the non-zero → zero transition
            let count_key = DataKey::OwnedTokenCount(from.clone());
            let count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            if count > 0 {
                let updated = count - 1;
                if updated == 0 {
                    e.storage().persistent().remove(&count_key);
                } else {
                    e.storage().persistent().set(&count_key, &updated);
                }
            }
        } else {
            e.storage().persistent().set(&key, &new_balance);
        }

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Burn"), from, token_id), amount);
    }

    fn balance_of(e: &Env, owner: Address, token_id: u128) -> u64 {
        e.storage()
            .persistent()
            .get(&DataKey::Balance(owner, token_id))
            .unwrap_or(0)
    }
}

#[contractimpl]
impl TycoonRewardSystem {
    pub fn test_mint(e: Env, to: Address, token_id: u128, amount: u64) {
        Self::_mint(&e, to, token_id, amount);
    }

    pub fn test_burn(e: Env, from: Address, token_id: u128, amount: u64) {
        Self::_burn(&e, from, token_id, amount);
    }
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod overflow_rounding_tests;
