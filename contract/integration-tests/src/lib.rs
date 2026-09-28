/// # Tycoon integration tests
///
/// Cross-contract integration tests exercising the complete set of contract
/// interactions — game flows, token flows, reward flows, multi-player sessions,
/// and stake-path flows (main game staking + refund).
mod fixture;
mod game_reward_flow;
mod game_token_flow;
mod multi_player_flow;
mod stake_paths_flow;
mod token_reward_flow;