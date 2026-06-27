// Cross-contract integration tests for the Tycoon smart contract suite (#411).
// Each module exercises a distinct cross-contract flow.
// All tests use an isolated Soroban Env — no shared state between tests.
#[cfg(test)]
mod fixture;
#[cfg(test)]
mod game_reward_flow;
#[cfg(test)]
mod game_token_flow;
#[cfg(test)]
mod multi_player_flow;
#[cfg(test)]
mod reward_transfer_flow;
// Stellar Wave (SW-FE-001): simulation scenarios
#[cfg(test)]
mod boost_admin_flow;
#[cfg(test)]
mod boost_system_integration;
// legacy_entrypoints requires reward-system test_mint helpers (#[cfg(test)] only).
// #[cfg(test)]
// mod legacy_entrypoints;
#[cfg(test)]
mod security_review_checklist;
#[cfg(test)]
mod simulation_scenarios;
#[cfg(test)]
mod token_reward_flow;
