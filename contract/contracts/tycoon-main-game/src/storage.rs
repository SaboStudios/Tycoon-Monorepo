use soroban_sdk::{contracttype, Address, Env};

/// Storage keys for the tycoon-main-game contract.
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// The contract admin/owner address.
    Owner,
    /// The reward system contract address used for voucher minting.
    RewardSystem,
    /// Tracks whether the contract has been initialized.
    IsInitialized,
    /// Marks whether a given address has registered as a player.
    Registered(Address),
}

// -----------------------------------------------------------------------
// Initialization
// -----------------------------------------------------------------------

/// Returns true if the contract has already been initialized.
pub fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::IsInitialized)
        .unwrap_or(false)
}

/// Sets the initialization flag.
pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::IsInitialized, &true);
}

// -----------------------------------------------------------------------
// Owner
// -----------------------------------------------------------------------

/// Retrieves the owner address. Panics if not set.
pub fn get_owner(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Owner)
        .expect("Owner not set")
}

/// Stores the owner address.
pub fn set_owner(env: &Env, owner: &Address) {
    env.storage().instance().set(&DataKey::Owner, owner);
}

// -----------------------------------------------------------------------
// Reward system
// -----------------------------------------------------------------------

/// Retrieves the reward system contract address. Panics if not set.
///
/// Used by future voucher minting logic — the reward system contract
/// exposes a `mint_voucher(player, amount)` function that this contract
/// will call upon successful player registration or game completion.
pub fn get_reward_system(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::RewardSystem)
        .expect("Reward system not set")
}

/// Stores the reward system contract address.
pub fn set_reward_system(env: &Env, address: &Address) {
    env.storage()
        .instance()
        .set(&DataKey::RewardSystem, address);
}

// -----------------------------------------------------------------------
// Player registration
// -----------------------------------------------------------------------

/// Returns true if the given address has been registered as a player.
pub fn is_registered(env: &Env, address: &Address) -> bool {
    env.storage()
        .persistent()
        .get(&DataKey::Registered(address.clone()))
        .unwrap_or(false)
}

/// Marks the given address as a registered player.
pub fn set_registered(env: &Env, address: &Address) {
    env.storage()
        .persistent()
        .set(&DataKey::Registered(address.clone()), &true);
}
