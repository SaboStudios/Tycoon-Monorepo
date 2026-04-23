#![no_std]
use soroban_sdk::{contract, contractevent, contractimpl, contracttype, Address, Env, Vec};

// ── Constants ─────────────────────────────────────────────────────────────────

/// Maximum number of boosts a single player may hold simultaneously.
/// Adding a boost when the player already holds this many panics with
/// `BoostError::CapExceeded`.
pub const MAX_BOOSTS_PER_PLAYER: u32 = 10;

// ── Error codes ───────────────────────────────────────────────────────────────

/// Canonical error codes returned (via panic message) for invalid boost operations.
///
/// | Code | Meaning |
/// |------|---------|
/// | `CapExceeded`      | Player already holds `MAX_BOOSTS_PER_PLAYER` active boosts |
/// | `DuplicateId`      | A boost with the same `id` is already active for this player |
/// | `InvalidValue`     | `value` is 0, which would have no effect |
/// | `InvalidExpiry`    | `expires_at_ledger` is in the past (≤ current ledger) |
/// | `NotInitialized`   | Contract has not been initialized yet |
/// | `AlreadyInitialized` | Contract has already been initialized |
/// | `Unauthorized`     | Caller is not the admin |
/// | `AlreadyInitialized` | `initialize` called more than once |
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BoostError {
    CapExceeded,
    DuplicateId,
    InvalidValue,
    InvalidExpiry,
    NotInitialized,
    AlreadyInitialized,
    Unauthorized,
}

// ── Data types ────────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BoostType {
    Multiplicative, // Stacks multiplicatively (e.g., 1.5x * 1.2x = 1.8x)
    Additive,       // Stacks additively (e.g., +10% + +5% = +15%)
    Override,       // Only highest-priority value applies
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Boost {
    pub id: u128,
    pub boost_type: BoostType,
    /// Boost magnitude in basis points (10 000 = 100 %).
    pub value: u32,
    /// Higher priority wins when two Override boosts compete.
    pub priority: u32,
    /// Ledger sequence number at which this boost expires.
    /// `0` means the boost never expires.
    pub expires_at_ledger: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Admin address — set once during `initialize`, never changed.
    Admin,
    /// Per-player boost list.
    Admin,
    PlayerBoosts(Address),
}

/// Emitted when a boost is successfully added to a player.
#[contractevent]
pub struct BoostActivatedEvent {
    #[topic]
    pub player: Address,
    #[topic]
    pub boost_id: u128,
    pub boost_type: BoostType,
    pub value: u32,
    pub expires_at_ledger: u32,
}

/// Emitted when one or more expired boosts are pruned from a player's list.
#[contractevent]
pub struct BoostExpiredEvent {
    #[topic]
    pub player: Address,
    pub boost_id: u32,
}

/// Emitted when all boosts are cleared for a player.
#[contractevent]
pub struct BoostsClearedEvent {
    #[topic]
    pub player: Address,
    pub count: u32,
}

/// Emitted when the admin grants a boost to a player on their behalf.
#[contractevent]
pub struct AdminBoostGrantedEvent {
    #[topic]
    pub player: Address,
    #[topic]
    pub boost_id: u128,
    pub boost_type: BoostType,
    pub value: u32,
    pub expires_at_ledger: u32,
}

/// Emitted when the admin revokes a specific boost from a player.
#[contractevent]
pub struct AdminBoostRevokedEvent {
    #[topic]
    pub player: Address,
    #[topic]
    pub boost_id: u128,
}

/// Emitted when a deprecated function is called.
/// Helps track migration progress and identify integrations that need updating.
#[contractevent]
pub struct DeprecatedFunctionCalledEvent {
    #[topic]
    pub function_name: u32, // Symbol short for function name
    #[topic]
    pub caller: Address,
    pub replacement_hint: u32, // Symbol short for recommended replacement
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Read the admin from instance storage. Panics if not initialized.
fn get_admin(env: &Env) -> Address {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .expect("NotInitialized")
}

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct TycoonBoostSystem;

// ── Admin-only entrypoints ────────────────────────────────────────────────────

#[contractimpl]
impl TycoonBoostSystem {
    /// Initialize the contract and set the admin address.
    ///
    /// Must be called exactly once before any other function.
    /// The `admin` address must authorize this call.
    ///
    /// # Errors
    /// - Panics with `"AlreadyInitialized"` if called more than once.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("AlreadyInitialized");
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
    }

    /// Grant a boost to a player on their behalf (admin only).
    ///
    /// Useful for rewarding players from off-chain game logic without
    /// requiring the player to sign the transaction themselves.
    ///
    /// The admin must authorize this call. The same validation rules as
    /// `add_boost` apply (value > 0, expiry in the future, cap, no duplicate id).
    ///
    /// # Errors (panic messages)
    /// - `"CapExceeded"` — player already holds `MAX_BOOSTS_PER_PLAYER` active boosts
    /// - `"DuplicateId"` — a boost with the same `id` is already active
    /// - `"InvalidValue"` — `boost.value` is 0
    /// - `"InvalidExpiry"` — `boost.expires_at_ledger` is non-zero and ≤ current ledger
    pub fn admin_grant_boost(env: Env, player: Address, boost: Boost) {
        let admin = get_admin(&env);
        admin.require_auth();

        // Validate value
        if boost.value == 0 {
            panic!("InvalidValue");
        }

        // Validate expiry: if set, must be strictly in the future
        let current_ledger = env.ledger().sequence();
        if boost.expires_at_ledger != 0 && boost.expires_at_ledger <= current_ledger {
            panic!("InvalidExpiry");
        }

        let key = DataKey::PlayerBoosts(player.clone());
        let mut boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        // Prune expired boosts before checking cap/duplicate
        boosts = Self::prune_expired(&env, boosts, player.clone());

        // Cap check
        if boosts.len() >= MAX_BOOSTS_PER_PLAYER {
            panic!("CapExceeded");
        }

        // Duplicate ID check
        for i in 0..boosts.len() {
            if boosts.get(i).unwrap().id == boost.id {
                panic!("DuplicateId");
            }
        }

        AdminBoostGrantedEvent {
            player: player.clone(),
            boost_id: boost.id,
            boost_type: boost.boost_type.clone(),
            value: boost.value,
            expires_at_ledger: boost.expires_at_ledger,
        }
        .publish(&env);

        boosts.push_back(boost);
        env.storage().persistent().set(&key, &boosts);
    }

    /// Revoke a specific boost from a player by boost id (admin only).
    ///
    /// Silently succeeds if the boost id is not found (idempotent).
    /// The admin must authorize this call.
    pub fn admin_revoke_boost(env: Env, player: Address, boost_id: u128) {
        let admin = get_admin(&env);
        admin.require_auth();

        let key = DataKey::PlayerBoosts(player.clone());
        let boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        let mut updated: Vec<Boost> = Vec::new(&env);
        let mut found = false;
        for i in 0..boosts.len() {
            let b = boosts.get(i).unwrap();
            if b.id == boost_id {
                found = true;
                // skip — effectively removing it
            } else {
                updated.push_back(b);
            }
        }

        if found {
            env.storage().persistent().set(&key, &updated);
            AdminBoostRevokedEvent {
                player,
                boost_id,
            }
            .publish(&env);
        }
    }

    /// Return the current admin address.
    pub fn admin(env: Env) -> Address {
        get_admin(&env)
    }
}

// ── Public (player-initiated) entrypoints ─────────────────────────────────────

#[contractimpl]
impl TycoonBoostSystem {
    // ── Admin entrypoints ─────────────────────────────────────────────────────

    /// One-time initialization. Sets the admin address.
    /// Panics with `"AlreadyInitialized"` if called again.
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().persistent().has(&DataKey::Admin) {
            panic!("AlreadyInitialized");
        }
        env.storage().persistent().set(&DataKey::Admin, &admin);
    }

    /// Grant a boost to a player. Admin-only.
    ///
    /// The `player` must authorize this call (self-service).
    /// To grant a boost on behalf of a player, use `admin_grant_boost`.
    ///
    /// # Errors (panic messages)
    /// - `"NotInitialized"` — contract has not been initialized
    /// - `"CapExceeded"` — player already holds `MAX_BOOSTS_PER_PLAYER` active boosts
    /// - `"DuplicateId"` — a boost with the same `id` is already active
    /// - `"InvalidValue"` — `boost.value` is 0
    /// - `"InvalidExpiry"` — `boost.expires_at_ledger` is non-zero and ≤ current ledger
    pub fn add_boost(env: Env, player: Address, boost: Boost) {
        Self::require_admin(&env);

        if boost.value == 0 {
            panic!("InvalidValue");
        }

        let current_ledger = env.ledger().sequence();
        if boost.expires_at_ledger != 0 && boost.expires_at_ledger <= current_ledger {
            panic!("InvalidExpiry");
        }

        let key = DataKey::PlayerBoosts(player.clone());
        let mut boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        boosts = Self::prune_expired(&env, boosts, player.clone());

        if boosts.len() >= MAX_BOOSTS_PER_PLAYER {
            panic!("CapExceeded");
        }

        for i in 0..boosts.len() {
            if boosts.get(i).unwrap().id == boost.id {
                panic!("DuplicateId");
            }
        }

        BoostActivatedEvent {
            player: player.clone(),
            boost_id: boost.id,
            boost_type: boost.boost_type.clone(),
            value: boost.value,
            expires_at_ledger: boost.expires_at_ledger,
        }
        .publish(&env);

        boosts.push_back(boost);
        env.storage().persistent().set(&key, &boosts);
    }

    /// Calculate the final boost multiplier for a player, ignoring expired boosts.
    ///
    /// Returns a value in basis points where 10 000 = 100 % (no boost).
    /// This is a read-only view — it does not mutate storage.
    pub fn calculate_total_boost(env: Env, player: Address) -> u32 {
    /// Remove all boosts for a player. Admin-only.
    pub fn clear_boosts(env: Env, player: Address) {
        Self::require_admin(&env);

        let key = DataKey::PlayerBoosts(player.clone());
        let count = env
            .storage()
            .persistent()
            .get::<DataKey, Vec<Boost>>(&key)
            .map(|v| v.len())
            .unwrap_or(0);
        env.storage().persistent().remove(&key);

        BoostsClearedEvent { player, count }.publish(&env);
    }

    // ── Public entrypoints ────────────────────────────────────────────────────

    /// Explicitly prune all expired boosts from storage and emit `BoostExpiredEvent`
    /// for each one removed. Returns the number of boosts pruned.
    ///
    /// # Deprecation Notice
    /// ⚠️ **DEPRECATED**: This function is deprecated and will be removed in v1.0.0.
    ///
    /// **Reason**: Manual pruning is unnecessary because:
    /// - `add_boost` automatically prunes expired boosts before adding new ones
    /// - `calculate_total_boost` ignores expired boosts without mutating storage
    /// - Adds unnecessary gas cost and complexity for clients
    ///
    /// **Migration**: Simply remove calls to this function. Expired boosts are
    /// automatically handled by other contract functions.
    ///
    /// **Timeline**: This function will be removed in v1.0.0 (Q4 2026).
    #[deprecated(
        since = "0.2.0",
        note = "Use automatic pruning via add_boost. This function will be removed in v1.0.0."
    )]
    /// Permissionless — anyone may call this to trigger cleanup.
    pub fn prune_expired_boosts(env: Env, player: Address) -> u32 {
        // Emit deprecation event
        DeprecatedFunctionCalledEvent {
            function_name: 1, // "prune_expired_boosts"
            caller: player.clone(),
            replacement_hint: 2, // "automatic"
        }
        .publish(&env);

        let key = DataKey::PlayerBoosts(player.clone());
        let boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        let before = boosts.len();
        let pruned = Self::prune_expired(&env, boosts, player.clone());
        let after = pruned.len();

        env.storage().persistent().set(&key, &pruned);

        before - after
    }

    /// Remove all boosts for a player.
    ///
    /// The `player` must authorize this call.
    pub fn clear_boosts(env: Env, player: Address) {
        player.require_auth();
    /// Calculate the final boost multiplier for a player, ignoring expired boosts.
    /// Returns a value in basis points where 10 000 = 100 % (no boost).
    pub fn calculate_total_boost(env: Env, player: Address) -> u32 {
        let key = DataKey::PlayerBoosts(player.clone());
        let boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        let current_ledger = env.ledger().sequence();
        let mut active: Vec<Boost> = Vec::new(&env);
        for i in 0..boosts.len() {
            let b = boosts.get(i).unwrap();
            if b.expires_at_ledger == 0 || b.expires_at_ledger > current_ledger {
                active.push_back(b);
            }
        }

        Self::apply_stacking_rules(&env, active)
    }

    /// Get all boosts for a player (including expired ones still in storage).
    ///
    /// # Deprecation Notice
    /// ⚠️ **DEPRECATED**: This function is deprecated and will be removed in v1.0.0.
    ///
    /// **Reason**: Returns expired boosts which:
    /// - Wastes gas reading stale data
    /// - Confuses clients (expired boosts have no effect)
    /// - Duplicates functionality with `get_active_boosts`
    ///
    /// **Migration**: Use `get_active_boosts` instead, which returns only
    /// non-expired boosts that actually affect calculations.
    ///
    /// **Timeline**: This function will be removed in v1.0.0 (Q4 2026).
    #[deprecated(
        since = "0.2.0",
        note = "Use get_active_boosts instead. This function will be removed in v1.0.0."
    )]
    pub fn get_boosts(env: Env, player: Address) -> Vec<Boost> {
        // Emit deprecation event
        DeprecatedFunctionCalledEvent {
            function_name: 3, // "get_boosts"
            caller: player.clone(),
            replacement_hint: 4, // "get_active_boosts"
        }
        .publish(&env);

        let key = DataKey::PlayerBoosts(player);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    /// Get only the active (non-expired) boosts for a player.
    ///
    /// This is the recommended replacement for the deprecated `get_boosts`.
    pub fn get_active_boosts(env: Env, player: Address) -> Vec<Boost> {
        let key = DataKey::PlayerBoosts(player.clone());
        let boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        let current_ledger = env.ledger().sequence();
        let mut active: Vec<Boost> = Vec::new(&env);
        for i in 0..boosts.len() {
            let b = boosts.get(i).unwrap();
            if b.expires_at_ledger == 0 || b.expires_at_ledger > current_ledger {
                active.push_back(b);
            }
        }
        active
    }
}

impl TycoonBoostSystem {
    /// Load the stored admin and require their signature. Panics with
    /// `"NotInitialized"` if the contract has not been initialized yet.
    fn require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Admin)
            .expect("NotInitialized");
        admin.require_auth();
    }

    /// Remove expired boosts from `boosts`, emitting `BoostExpiredEvent` for each.
    fn prune_expired(env: &Env, boosts: Vec<Boost>, player: Address) -> Vec<Boost> {
        let current_ledger = env.ledger().sequence();
        let mut active: Vec<Boost> = Vec::new(env);
        for i in 0..boosts.len() {
            let b = boosts.get(i).unwrap();
            if b.expires_at_ledger != 0 && b.expires_at_ledger <= current_ledger {
                BoostExpiredEvent {
                    player: player.clone(),
                    boost_id: b.id as u32,
                }
                .publish(env);
            } else {
                active.push_back(b);
            }
        }
        active
    }

    fn apply_stacking_rules(_env: &Env, boosts: Vec<Boost>) -> u32 {
        if boosts.is_empty() {
            return 10000; // Base 100% in basis points
        }

        let mut multiplicative_total: u32 = 10000;
        let mut additive_total: u32 = 0;
        let mut override_boost: Option<Boost> = None;

        for i in 0..boosts.len() {
            let boost = boosts.get(i).unwrap();

            match boost.boost_type {
                BoostType::Multiplicative => {
                    multiplicative_total =
                        (multiplicative_total as u64 * boost.value as u64 / 10000) as u32;
                }
                BoostType::Additive => {
                    additive_total += boost.value;
                }
                BoostType::Override => {
                    if let Some(ref current) = override_boost {
                        if boost.priority > current.priority {
                            override_boost = Some(boost);
                        }
                    } else {
                        override_boost = Some(boost);
                    }
                }
            }
        }

        if let Some(override_val) = override_boost {
            override_val.value
        } else {
            (multiplicative_total as u64 * (10000 + additive_total as u64) / 10000) as u32
        }
    }
}

#[cfg(test)]
mod test;

#[cfg(test)]
mod cap_stacking_expiry_tests;

#[cfg(test)]
mod time_boundary_tests;

#[cfg(test)]
mod advanced_integration_tests;

#[cfg(test)]
mod deprecation_tests;

#[cfg(test)]
mod admin_access_control_tests;
