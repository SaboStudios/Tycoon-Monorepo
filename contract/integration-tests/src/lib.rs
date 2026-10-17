//! Integration tests for the Tycoon contracts.
//!
//! This crate exercises the complete set of contract interactions across the
//! workspace, including the main game, rewards, tokens, staking, boosts and
//! collectibles.

pub mod fixture;
pub mod game_reward_flow;
pub mod game_token_flow;
pub mod multi_player_flow;
pub mod stake_paths_flow;
pub mod token_reward_flow;
pub mod boost_collectible_flow;
