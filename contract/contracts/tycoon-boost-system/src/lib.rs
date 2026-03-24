#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum BoostType {
    Multiplicative, // Stacks multiplicatively (e.g., 1.5x * 1.2x = 1.8x)
    Additive,       // Stacks additively (e.g., +10% + +5% = +15%)
    Override,       // Only highest value applies
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Boost {
    pub id: u128,
    pub boost_type: BoostType,
    pub value: u32,    // Basis points (100 = 1%)
    pub priority: u32, // Higher priority wins for Override type
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    PlayerBoosts(Address), // Address -> Vec<Boost>
}

#[contract]
pub struct TycoonBoostSystem;

#[contractimpl]
impl TycoonBoostSystem {
    /// Add a boost to a player
    pub fn add_boost(env: Env, player: Address, boost: Boost) {
        player.require_auth();

        let key = DataKey::PlayerBoosts(player.clone());
        let mut boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));
        boosts.push_back(boost);
        env.storage().persistent().set(&key, &boosts);
    }

    /// Calculate final boost value with stacking rules
    pub fn calculate_total_boost(env: Env, player: Address) -> u32 {
        let key = DataKey::PlayerBoosts(player);
        let boosts: Vec<Boost> = env
            .storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env));

        Self::apply_stacking_rules(&env, boosts)
    }

    /// Remove all boosts for a player
    pub fn clear_boosts(env: Env, player: Address) {
        player.require_auth();
        let key = DataKey::PlayerBoosts(player);
        env.storage().persistent().remove(&key);
    }

    /// Get all boosts for a player
    pub fn get_boosts(env: Env, player: Address) -> Vec<Boost> {
        let key = DataKey::PlayerBoosts(player);
        env.storage()
            .persistent()
            .get(&key)
            .unwrap_or(Vec::new(&env))
    }
}

impl TycoonBoostSystem {
    fn apply_stacking_rules(_env: &Env, boosts: Vec<Boost>) -> u32 {
        if boosts.is_empty() {
            return 10000; // Base 100% (in basis points)
        }

        let mut multiplicative_total: u32 = 10000;
        let mut additive_total: u32 = 0;
        let mut override_boost: Option<Boost> = None;

        for i in 0..boosts.len() {
            let boost = boosts.get(i).unwrap();

            match boost.boost_type {
                BoostType::Multiplicative => {
                    // Multiply: (current * boost_value) / 10000
                    multiplicative_total =
                        (multiplicative_total as u64 * boost.value as u64 / 10000) as u32;
                }
                BoostType::Additive => {
                    additive_total += boost.value;
                }
                BoostType::Override => {
                    // Keep highest priority override
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

        // Priority: Override > Multiplicative * Additive
        if let Some(override_val) = override_boost {
            override_val.value
        } else {
            // Apply additive to multiplicative: mult * (1 + additive)
            (multiplicative_total as u64 * (10000 + additive_total as u64) / 10000) as u32
        }
    }
}

mod test;
