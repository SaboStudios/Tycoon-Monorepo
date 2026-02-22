#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

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
}

#[contract]
pub struct TycoonRewardSystem;

#[contractimpl]
/// Emergency Pause/Unpause
///
/// The admin can pause the contract in case of vulnerability or exploit. While paused, redeem_voucher_from is disabled.
/// Use pause(env) to pause, unpause(env) to resume. Only admin can call these functions.
/// Events are emitted for Paused/Unpaused. This mechanism is for emergency use only.
impl TycoonRewardSystem {
    pub fn initialize(e: Env, admin: Address, tyc_token: Address, usdc_token: Address) {
        if e.storage().persistent().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        e.storage().persistent().set(&DataKey::Admin, &admin);
        e.storage().persistent().set(&DataKey::TycToken, &tyc_token);
        e.storage()
            .persistent()
            .set(&DataKey::UsdcToken, &usdc_token);
        e.storage()
            .persistent()
            .set(&DataKey::VoucherCount, &VOUCHER_ID_START);
        e.storage().persistent().set(&DataKey::Paused, &false);
    }

    /// Emergency pause contract (admin only)
    /// Use in case of vulnerability or exploit. Pauses redeem functionality.
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
    /// Use to resume normal operation after emergency.
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
    /// 
    /// # Arguments
    /// * `admin` - Admin address for authentication
    /// * `new_minter` - Address to set as backend minter.
    /// 
    /// # Panics
    /// * If caller is not admin
    pub fn set_backend_minter(e: Env, admin: Address, new_minter: Address) {
        // Get stored admin for validation
        let stored_admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        
        // Verify caller is admin
        if admin != stored_admin {
            panic!("Unauthorized: only admin can set backend minter");
        }
        admin.require_auth();

        // Store the new minter
        e.storage()
            .persistent()
            .set(&DataKey::BackendMinter, &new_minter);

        // Emit event
        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("set_min"), new_minter), ());
    }

    /// Clear the backend minter address (admin only)
    /// 
    /// # Arguments
    /// * `admin` - Admin address for authentication
    /// 
    /// # Panics
    /// * If caller is not admin
    pub fn clear_backend_minter(e: Env, admin: Address) {
        // Get stored admin for validation
        let stored_admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        
        // Verify caller is admin
        if admin != stored_admin {
            panic!("Unauthorized: only admin can clear backend minter");
        }
        admin.require_auth();

        // Remove the backend minter
        e.storage()
            .persistent()
            .remove(&DataKey::BackendMinter);

        // Emit event
        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("clr_min"),), ());
    }

    /// Get the current backend minter address
    /// Returns None if not set
    pub fn get_backend_minter(e: Env) -> Option<Address> {
        if e.storage().persistent().has(&DataKey::BackendMinter) {
            Some(e.storage()
                .persistent()
                .get(&DataKey::BackendMinter)
                .unwrap())
        } else {
            None
        }
    }

    pub fn mint_voucher(e: Env, caller: Address, to: Address, tyc_value: u128) -> u128 {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        caller.require_auth();

        // Check if caller is admin or backend minter
        let backend_minter: Option<Address> = if e.storage().persistent().has(&DataKey::BackendMinter) {
            Some(e.storage()
                .persistent()
                .get(&DataKey::BackendMinter)
                .unwrap())
        } else {
            None
        };

        let is_admin = caller == admin;
        let is_backend_minter = backend_minter.is_some() && backend_minter.unwrap() == caller;

        if !is_admin && !is_backend_minter {
            panic!("Unauthorized: only admin or backend minter can mint");
        }

        let mut current_id: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherCount)
            .unwrap_or(VOUCHER_ID_START);
        let token_id = current_id;
        current_id += 1;
        e.storage()
            .persistent()
            .set(&DataKey::VoucherCount, &current_id);

        e.storage()
            .persistent()
            .set(&DataKey::VoucherValue(token_id), &tyc_value);

        Self::_mint(&e, to.clone(), token_id, 1);

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("V_Mint"), to, token_id), tyc_value);

        token_id
    }

    pub fn redeem_voucher(_e: Env, _token_id: u128) {
        // Wrapper entry point that panics directing to redeem_voucher_from
        panic!("Use redeem_voucher_from instead");
    }

    pub fn redeem_voucher_from(e: Env, redeemer: Address, token_id: u128) {
        redeemer.require_auth();
        let paused: bool = e
            .storage()
            .persistent()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("Contract is paused");
        }
        let tyc_value: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherValue(token_id))
            .expect("Invalid token_id");
        // Burn the voucher (amount=1)
        Self::_burn(&e, redeemer.clone(), token_id, 1);
        // Transfer TYC
        let tyc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::TycToken)
            .expect("Not initialized");
        let client = soroban_sdk::token::Client::new(&e, &tyc_token);
        // Transfer from Contract to Redeemer
        let contract_address = e.current_contract_address();
        client.transfer(&contract_address, &redeemer, &(tyc_value as i128));
        // Delete storage
        e.storage()
            .persistent()
            .remove(&DataKey::VoucherValue(token_id));
        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Redeem"), redeemer, token_id), tyc_value);
    }

    /// Withdraw funds from the contract (admin only)
    ///
    /// # Arguments
    /// * `token` - Token address to withdraw (must be TYC or configured USDC)
    /// * `to` - Recipient address
    /// * `amount` - Amount to withdraw
    ///
    /// # Panics
    /// * If caller is not admin
    /// * If token is not in allowlist (TYC or USDC)
    /// * If contract has insufficient balance
    pub fn withdraw_funds(e: Env, token: Address, to: Address, amount: u128) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();

        // Validate token is in allowlist (TYC or USDC)
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

        // Create token client and check balance
        let token_client = soroban_sdk::token::Client::new(&e, &token);
        let contract_address = e.current_contract_address();
        let balance = token_client.balance(&contract_address);

        if balance < amount as i128 {
            panic!("Insufficient contract balance");
        }

        // Transfer from contract to recipient
        token_client.transfer(&contract_address, &to, &(amount as i128));

        // Emit withdrawal event
        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Withdraw"), token.clone(), to), amount);
    }

    // Internal helper to mint tokens
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

        let paused: bool = e
            .storage()
            .persistent()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("Contract is paused");
        }

        Self::_burn(&e, from.clone(), token_id, amount);
        Self::_mint(&e, to.clone(), token_id, amount);

        #[allow(deprecated)]
        e.events().publish(
            (symbol_short!("Transfer"), from, to, token_id),
            amount,
        );
    }
}

impl TycoonRewardSystem {
    fn _mint(e: &Env, to: Address, token_id: u128, amount: u64) {
        if amount == 0 {
            return;
        }
        let key = DataKey::Balance(to.clone(), token_id);
        let current_balance: u64 = e.storage().persistent().get(&key).unwrap_or(0);

        // Overflow check
        let new_balance = current_balance
            .checked_add(amount)
            .expect("Balance overflow");

        e.storage().persistent().set(&key, &new_balance);

        // Update OwnedTokenCount if receiving this token for the first time
        if current_balance == 0 {
            let count_key = DataKey::OwnedTokenCount(to.clone());
            let current_count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            e.storage().persistent().set(&count_key, &(current_count + 1));
        }

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Mint"), to, token_id), amount);
    }

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
            e.storage().persistent().remove(&key);
        } else {
            e.storage().persistent().set(&key, &new_balance);
        }

        // Update OwnedTokenCount if losing the last of this token
        if current_balance > 0 && new_balance == 0 {
            let count_key = DataKey::OwnedTokenCount(from.clone());
            let current_count: u32 = e.storage().persistent().get(&count_key).unwrap_or(0);
            if current_count > 0 {
                let updated_count = current_count - 1;
                if updated_count == 0 {
                    e.storage().persistent().remove(&count_key);
                } else {
                    e.storage().persistent().set(&count_key, &updated_count);
                }
            }
        }

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Burn"), from, token_id), amount);
    }

    fn balance_of(e: &Env, owner: Address, token_id: u128) -> u64 {
        let key = DataKey::Balance(owner, token_id);
        e.storage().persistent().get(&key).unwrap_or(0)
    }
}

#[contractimpl]
impl TycoonRewardSystem {
    // Public wrapper for testing mint
    pub fn test_mint(e: Env, to: Address, token_id: u128, amount: u64) {
        Self::_mint(&e, to, token_id, amount);
    }

    // Public wrapper for testing burn
    pub fn test_burn(e: Env, from: Address, token_id: u128, amount: u64) {
        Self::_burn(&e, from, token_id, amount);
    }
}

#[cfg(test)]
mod test;
