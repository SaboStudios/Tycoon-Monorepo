#![no_std]
use soroban_sdk::{contract, contracterror, contractevent, contractimpl, contracttype, symbol_short, Address, Env, Symbol};

const VOUCHER_ID_START: u128 = 1_000_000_000;

/// Stable error codes for the reward contract.
///
/// Discriminants are pinned so the backend can branch on a number instead of
/// matching host error text. Do not renumber existing variants.
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum RewardError {
    /// "Already initialized"
    AlreadyInitialized = 1,
    /// "Contract is paused"
    ContractPaused = 2,
    /// "Insufficient balance"
    InsufficientBalance = 3,
    /// "Invalid token: not in allowlist"
    InvalidToken = 4,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PausedEvent {
    #[topic]
    pub admin: Address,
    pub paused: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnpausedEvent {
    #[topic]
    pub admin: Address,
    pub paused: bool,
}

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
    // Running sum of VoucherValue for vouchers with non-zero supply
    VoucherLiability,
}

#[contract]
pub struct TycoonRewardSystem;

#[contractimpl]
impl TycoonRewardSystem {
    pub fn initialize(e: Env, admin: Address, tyc_token: Address, usdc_token: Address) -> Result<(), RewardError> {
        if e.storage().persistent().has(&DataKey::Admin) {
            return Err(RewardError::AlreadyInitialized);
        }
        // Require the admin to authorize initialization before any storage write
        admin.require_auth();
        // Batch all initialization writes together
        e.storage().persistent().set(&DataKey::Admin, &admin);
        e.storage().persistent().set(&DataKey::TycToken, &tyc_token);
        e.storage().persistent().set(&DataKey::UsdcToken, &usdc_token);
        e.storage().persistent().set(&DataKey::VoucherCount, &VOUCHER_ID_START);
        e.storage().persistent().set(&DataKey::Paused, &false);
        e.storage().persistent().set(&DataKey::StateVersion, &1u32);
        e.storage().persistent().set(&DataKey::VoucherLiability, &0u128);
        Ok(())
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
        PausedEvent {
            admin: admin.clone(),
            paused: true,
        }
        .publish(&e);
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
        UnpausedEvent {
            admin: admin.clone(),
            paused: false,
        }
        .publish(&e);
    }

    /// Set the backend minter address (admin only)
    pub fn set_backend_minter(e: Env, new_minter: Address) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();
        e.storage().persistent().set(&DataKey::BackendMinter, &new_minter);
        #[allow(deprecated)]
        e.events().publish((symbol_short!("set_min"), new_minter), ());
    }

    /// Clear the backend minter address (admin only)
    pub fn clear_backend_minter(e: Env) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
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

    /// Mint a voucher. `tyc_value` is stored as `u128` but must fit in `i128`
    /// (the token amount type); values above `i128::MAX` cannot be redeemed.
    pub fn mint_voucher(e: Env, caller: Address, to: Address, tyc_value: u128) -> Result<u128, RewardError> {
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

        // Reject minting while paused, before any storage or token change
        if e.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Paused)
            .unwrap_or(false)
        {
            panic!("Contract is paused");
        }

        // Reject zero-value vouchers before consuming an id or emitting events.
        // Stable error string so the backend can map it deterministically.
        if tyc_value == 0 {
            panic!("Invalid voucher value: must be greater than zero");
        }
        }

        // Read-increment-write in one block; no intermediate clone needed
        let token_id: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherCount)
            .unwrap_or(VOUCHER_ID_START);
        let next_id = token_id
            .checked_add(1)
            .expect("Voucher counter overflow");
        e.storage()
            .persistent()
            .set(&DataKey::VoucherCount, &next_id);

        e.storage()
            .persistent()
            .set(&DataKey::VoucherValue(token_id), &tyc_value);

        // Track outstanding voucher liability so withdrawals cannot drain backing
        let liability: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherLiability)
            .unwrap_or(0);
        e.storage()
            .persistent()
            .set(&DataKey::VoucherLiability, &(liability + tyc_value));

        // _mint emits its own "Mint" event; no extra event needed here
        Self::_mint(&e, to.clone(), token_id, 1);

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("V_Mint"), to, token_id), tyc_value);

        Ok(token_id)
    }

    pub fn redeem_voucher_from(e: Env, redeemer: Address, token_id: u128) -> Result<(), RewardError> {
        redeemer.require_auth();

        // Single read for Paused — unwrap_or avoids a separate has() check
        if e.storage()
            .persistent()
            .get::<DataKey, bool>(&DataKey::Paused)
            .unwrap_or(false)
        {
            return Err(RewardError::ContractPaused);
        }

        let tyc_value: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherValue(token_id))
            .expect("Invalid token_id");

        // Checked conversion before burn: reject values that do not fit in i128
        // so we never burn a voucher we cannot pay out.
        let payout: i128 = match i128::try_from(tyc_value) {
            Ok(v) => v,
            Err(_) => panic!("Voucher value overflows i128"),
        };

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
            &payout,
        );

        // Remove voucher value entry after successful transfer
        e.storage().persistent().remove(&DataKey::VoucherValue(token_id));

        // Redeemed voucher no longer counts toward outstanding liability
        let liability: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherLiability)
            .unwrap_or(0);
        e.storage()
            .persistent()
            .set(&DataKey::VoucherLiability, &liability.saturating_sub(tyc_value));

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Redeem"), redeemer, token_id), tyc_value);

        Ok(())
    }

    /// Withdraw funds from the contract (admin only). `amount` is `u128` but
    /// must fit in `i128` (the token amount type).
    pub fn withdraw_funds(e: Env, token: Address, to: Address, amount: u128) {
        let admin: Address = e
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("Not initialized");
        admin.require_auth();

        // Checked conversion before transfer: reject values that do not fit in i128
        let payout: i128 = match i128::try_from(amount) {
            Ok(v) => v,
            Err(_) => panic!("Withdraw amount overflows i128"),
        };

        // Reject withdrawals that would underfund outstanding vouchers
        let liability: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::TycToken)
            .expect("Not initialized");
        let usdc_token: Address = e
            .storage()
            .persistent()
            .get(&DataKey::UsdcToken)
            .expect("Not initialized");
        let _ = (tyc_token, usdc_token);

        // Reject withdrawals that would underfund outstanding vouchers
        let liability: u128 = e
            .storage()
            .persistent()
            .get(&DataKey::VoucherLiability)
            .unwrap_or(0);
        let balance = soroban_sdk::token::Client::new(&e, &token).balance(
            &e.current_contract_address(),
        ) as u128;
        if balance.saturating_sub(amount) < liability {
            panic!("Withdrawal would underfund outstanding vouchers");
        }
        }

        soroban_sdk::token::Client::new(&e, &token).transfer(
            &e.current_contract_address(),
            &to,
            &(amount as i128),
        );

        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Withdraw"), to, token), amount);
    }

    fn _mint(e: &Env, to: Address, token_id: u128, amount: u128) {
        let key = DataKey::Balance(to.clone(), token_id);
        let current: u128 = e.storage().persistent().get(&key).unwrap_or(0);
        let new_balance = current.checked_add(amount).expect("Balance overflow");
        e.storage().persistent().set(&key, &new_balance);

        if current == 0 && amount > 0 {
            let count_key = DataKey::OwnedTokenCount(to.clone());
            let count: u128 = e.storage().persistent().get(&count_key).unwrap_or(0);
            let new_count = count.checked_add(1).expect("Owned count overflow");
            e.storage().persistent().set(&count_key, &new_count);
        }
        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Mint"), to, token_id), amount);
    }

    fn _burn(e: &Env, from: Address, token_id: u128, amount: u128) {
        let key = DataKey::Balance(from.clone(), token_id);
        let current: u128 = e.storage().persistent().get(&key).unwrap_or(0);
        if current < amount {
            panic!("Insufficient balance");
        }
        let new_balance = current - amount;
        if new_balance == 0 {
            e.storage().persistent().remove(&key);
            let count_key = DataKey::OwnedTokenCount(from.clone());
            let owned: u128 = e.storage().persistent().get(&count_key).unwrap_or(0);
            e.storage()
                .persistent()
                .set(&count_key, &owned.saturating_sub(1));
        } else {
            e.storage().persistent().set(&key, &new_balance);
        }
        #[allow(deprecated)]
        e.events()
            .publish((symbol_short!("Burn"), from, token_id), amount);
    }

    /* … remaining implementation unchanged … */
}
