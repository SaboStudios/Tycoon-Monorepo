use soroban_sdk::{contracttype, symbol_short, Address, Env, Symbol, Vec};

// ============================================================
// Pause-related types (re-exported from tycoon-lib concept)
// ============================================================

/// Pause configuration for multisig support
#[contracttype]
#[derive(Clone, Debug)]
pub struct PauseConfig {
    /// Admin address (single admin mode)
    pub admin: Option<Address>,
    /// Multisig signers (if using multisig)
    pub signers: Vec<Address>,
    /// Required signatures for multisig (0 = single admin mode)
    pub required_signatures: u32,
}

/// Pause reasons for transparency
#[contracttype]
#[derive(Clone, Debug)]
pub enum PauseReason {
    SecurityIssue,
    Upgrade,
    Compliance,
    MarketConditions,
    Maintenance,
    Emergency,
    Custom(Symbol),
}

/// Pause status details
#[contracttype]
#[derive(Clone, Debug)]
pub struct PauseStatus {
    pub is_paused: bool,
    pub paused_by: Option<Address>,
    pub paused_at: Option<u64>,
    pub expiry: Option<u32>,
    pub reason: Option<Symbol>,
}

// ============================================================
// Storage Keys
// ============================================================

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// The contract admin/owner address
    Admin,
    /// Pause configuration
    PauseConfig,
    /// Whether the contract is currently paused
    Paused,
    /// Address that initiated the pause
    PausedBy,
    /// Ledger timestamp when pause was initiated
    PausedAt,
    /// Optional: Ledger sequence when pause should auto-expire (0 = no expiry)
    PauseExpiry,
    /// Reason for pause
    PauseReason,
    /// Tracks whether the contract has been initialized
    IsInitialized,
}

// ============================================================
// Initialization helpers
// ============================================================

pub fn is_initialized(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::IsInitialized)
        .unwrap_or(false)
}

pub fn set_initialized(env: &Env) {
    env.storage().instance().set(&DataKey::IsInitialized, &true);
}

// ============================================================
// Admin helpers
// ============================================================

pub fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("Admin not set")
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

// ============================================================
// Pause configuration helpers
// ============================================================

pub fn set_pause_config(env: &Env, config: &PauseConfig) {
    env.storage()
        .persistent()
        .set(&DataKey::PauseConfig, config);
}

pub fn get_pause_config(env: &Env) -> Option<PauseConfig> {
    env.storage().persistent().get(&DataKey::PauseConfig)
}

// ============================================================
// Pause state helpers
// ============================================================

/// Check if the contract is currently paused (with auto-expiry check)
pub fn is_paused(env: &Env) -> bool {
    let paused: bool = env
        .storage()
        .persistent()
        .get(&DataKey::Paused)
        .unwrap_or(false);

    if !paused {
        return false;
    }

    // Check if pause has expired
    let expiry: u32 = env
        .storage()
        .persistent()
        .get(&DataKey::PauseExpiry)
        .unwrap_or(0);

    if expiry > 0 && env.ledger().sequence() >= expiry {
        // Auto-unpause if expired
        unpause(env);
        return false;
    }

    true
}

/// Require that the contract is not paused
pub fn require_not_paused(env: &Env, operation: Symbol) {
    if is_paused(env) {
        panic_with_pause_reason(env, operation);
    }
}

/// Panic with detailed pause reason
fn panic_with_pause_reason(env: &Env, operation: Symbol) -> ! {
    let reason: Symbol = env
        .storage()
        .persistent()
        .get(&DataKey::PauseReason)
        .unwrap_or(symbol_short!("unknown"));

    let paused_by: Address = env
        .storage()
        .persistent()
        .get(&DataKey::PausedBy)
        .unwrap_or_else(|| Address::from_str(env, ""));

    panic!(
        "Operation {:?} blocked: contract paused by {:?} (reason: {:?})",
        operation, paused_by, reason
    );
}

/// Pause with expiry
pub fn pause_with_expiry(env: &Env, caller: &Address, reason: &Symbol, duration_ledgers: u32) {
    let current_ledger = env.ledger().sequence();
    let expiry = current_ledger + duration_ledgers;

    env.storage().persistent().set(&DataKey::Paused, &true);
    env.storage().persistent().set(&DataKey::PausedBy, caller);
    env.storage()
        .persistent()
        .set(&DataKey::PausedAt, &env.ledger().timestamp());
    env.storage()
        .persistent()
        .set(&DataKey::PauseExpiry, &expiry);
    env.storage()
        .persistent()
        .set(&DataKey::PauseReason, reason);
}

/// Unpause the contract
pub fn unpause(env: &Env) {
    env.storage().persistent().set(&DataKey::Paused, &false);
    env.storage().persistent().remove(&DataKey::PausedBy);
    env.storage().persistent().remove(&DataKey::PausedAt);
    env.storage().persistent().remove(&DataKey::PauseExpiry);
    env.storage().persistent().remove(&DataKey::PauseReason);
}

/// Get paused_by address
pub fn get_paused_by(env: &Env) -> Option<Address> {
    env.storage().persistent().get(&DataKey::PausedBy)
}

/// Get paused_at timestamp
pub fn get_paused_at(env: &Env) -> Option<u64> {
    env.storage().persistent().get(&DataKey::PausedAt)
}

/// Get pause status
pub fn get_pause_status(env: &Env) -> PauseStatus {
    let paused = is_paused(env);

    PauseStatus {
        is_paused: paused,
        paused_by: env.storage().persistent().get(&DataKey::PausedBy),
        paused_at: env.storage().persistent().get(&DataKey::PausedAt),
        expiry: env.storage().persistent().get(&DataKey::PauseExpiry),
        reason: env.storage().persistent().get(&DataKey::PauseReason),
    }
}

// ============================================================
// Authorization helpers
// ============================================================

/// Check if an address is authorized to pause/unpause
pub fn is_authorized_to_pause(_env: &Env, caller: &Address, config: &PauseConfig) -> bool {
    // Single admin mode
    if let Some(admin) = &config.admin {
        if caller == admin {
            return true;
        }
    }

    // Multisig mode - check if caller is one of the signers
    if config.required_signatures > 0 && !config.signers.is_empty() {
        for signer in config.signers.iter() {
            if caller == &signer {
                return true;
            }
        }
    }

    false
}
