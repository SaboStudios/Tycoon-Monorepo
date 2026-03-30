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
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BoostError {
    CapExceeded,
    DuplicateId,
    InvalidValue,
    InvalidExpiry,
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
    PlayerBoosts(Address),
}

// ── Events ────────────────────────────────────────────────────────────────────

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

// ── Contract ──────────────────────────────────────────────────────────────────

#[contract]
pub struct TycoonBoostSystem;

#[contractimpl]
impl TycoonBoostSystem {
    /// Add a boost to a player.
    ///
    /// # Errors (panic messages)
    /// - `"CapExceeded"` — player already holds `MAX_BOOSTS_PER_PLAYER` active boosts
    /// - `"DuplicateId"` — a boost with the same `id` is already active
    /// - `"InvalidValue"` — `boost.value` is 0
    /// - `"InvalidExpiry"` — `boost.expires_at_ledger` is non-zero and ≤ current ledger
    pub fn add_boost(env: Env, player: Address, boost: Boost) {
        player.require_auth();

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

        // Emit activation event
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
    pub fn calculate_total_boost(env: Env, player: Address) -> u32 {
        let key = DataKey::PlayerBoosts(player.clone());
        let boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        // Filter out expired boosts for calculation (does not mutate storage)
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

    /// Explicitly prune all expired boosts from storage and emit `BoostExpiredEvent`
    /// for each one removed. Returns the number of boosts pruned.
    pub fn prune_expired_boosts(env: Env, player: Address) -> u32 {
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
    pub fn clear_boosts(env: Env, player: Address) {
        player.require_auth();
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

    /// Get all boosts for a player (including expired ones still in storage).
    pub fn get_boosts(env: Env, player: Address) -> Vec<Boost> {
        let key = DataKey::PlayerBoosts(player);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }

    /// Get only the active (non-expired) boosts for a player.
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
                    // (current * boost_value) / 10000
                    multiplicative_total =
                        (multiplicative_total as u64 * boost.value as u64 / 10000) as u32;
                }
                BoostType::Additive => {
                    additive_total += boost.value;
                }
                BoostType::Override => {
                    // Keep highest-priority override
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

        // Priority: Override > Multiplicative combined with Additive
        if let Some(override_val) = override_boost {
            override_val.value
        } else {
            // mult * (1 + additive)
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
