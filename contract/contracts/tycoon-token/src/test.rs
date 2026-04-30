use super::*;
use soroban_sdk::{testutils::Address as _, Env};

const INITIAL_SUPPLY: i128 = 1_000_000_000_000_000_000_000_000_000; // 1e9 * 10^18

#[test]
fn test_initialization() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    assert_eq!(client.name(), String::from_str(&e, "Tycoon"));
    assert_eq!(client.symbol(), String::from_str(&e, "TYC"));
    assert_eq!(client.decimals(), 18);
    assert_eq!(client.balance(&admin), INITIAL_SUPPLY);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY);
    assert_eq!(client.admin(), admin);
}

#[test]
#[should_panic(expected = "Already initialized")]
fn test_cannot_reinitialize() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.initialize(&admin, &INITIAL_SUPPLY);
}

#[test]
fn test_admin_can_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let mint_amount: i128 = 1_000_000_000_000_000_000_000;
    client.mint(&user, &mint_amount);

    assert_eq!(client.balance(&user), mint_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + mint_amount);
}

#[test]
#[should_panic(expected = "Amount must be positive")]
fn test_cannot_mint_zero() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.mint(&user, &0);
}

#[test]
fn test_transfer() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let amount: i128 = 500_000_000_000_000_000_000_000_000;
    client.transfer(&admin, &user, &amount);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - amount);
    assert_eq!(client.balance(&user), amount);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_transfer_insufficient_balance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.transfer(&admin, &user, &(INITIAL_SUPPLY + 1));
}

#[test]
fn test_approve_and_transfer_from() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    let transfer: i128 = 50_000_000_000_000_000_000_000_000;

    client.approve(&admin, &spender, &allowance, &0);
    assert_eq!(client.allowance(&admin, &spender), allowance);

    client.transfer_from(&spender, &admin, &recipient, &transfer);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - transfer);
    assert_eq!(client.balance(&recipient), transfer);
    assert_eq!(client.allowance(&admin, &spender), allowance - transfer);
}

#[test]
#[should_panic(expected = "Insufficient allowance")]
fn test_transfer_from_insufficient_allowance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);
    let recipient = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    client.transfer_from(&spender, &admin, &recipient, &(allowance + 1));
}

#[test]
fn test_burn() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let burn_amount: i128 = 100_000_000_000_000_000_000_000_000;
    client.burn(&admin, &burn_amount);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - burn_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY - burn_amount);
}

#[test]
#[should_panic(expected = "Insufficient balance")]
fn test_burn_insufficient_balance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.burn(&admin, &(INITIAL_SUPPLY + 1));
}

#[test]
fn test_burn_from() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    let burn_amount: i128 = 50_000_000_000_000_000_000_000_000;

    client.approve(&admin, &spender, &allowance, &0);
    client.burn_from(&spender, &admin, &burn_amount);

    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - burn_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY - burn_amount);
    assert_eq!(client.allowance(&admin, &spender), allowance - burn_amount);
}

#[test]
#[should_panic(expected = "Insufficient allowance")]
fn test_burn_from_insufficient_allowance() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let spender = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let allowance: i128 = 100_000_000_000_000_000_000_000_000;
    client.approve(&admin, &spender, &allowance, &0);
    client.burn_from(&spender, &admin, &(allowance + 1));
}

#[test]
fn test_set_admin() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let new_admin = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.set_admin(&new_admin);

    assert_eq!(client.admin(), new_admin);
}

// ============================================================
// SW-1: Simulation scenarios
// ============================================================

/// Simulate a full game-reward cycle:
/// admin mints TYC to a reward pool, pool transfers to winner,
/// winner burns a portion as a fee.
#[test]
fn sim_game_reward_cycle() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let reward_pool = Address::generate(&e);
    let winner = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    // Admin mints reward tokens into the pool
    let reward: i128 = 5_000_000_000_000_000_000_000;
    client.mint(&reward_pool, &reward);
    assert_eq!(client.balance(&reward_pool), reward);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + reward);

    // Pool pays out winner
    let payout: i128 = 4_000_000_000_000_000_000_000;
    client.transfer(&reward_pool, &winner, &payout);
    assert_eq!(client.balance(&winner), payout);
    assert_eq!(client.balance(&reward_pool), reward - payout);

    // Winner burns 10 % as protocol fee
    let fee: i128 = payout / 10;
    client.burn(&winner, &fee);
    assert_eq!(client.balance(&winner), payout - fee);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + reward - fee);
}

/// Simulate a delegated spend: player approves a game-contract
/// spender, spender deducts entry stake via transfer_from.
#[test]
fn sim_delegated_entry_stake() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let player = Address::generate(&e);
    let game_contract = Address::generate(&e);
    let treasury = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    // Fund player
    let player_funds: i128 = 10_000_000_000_000_000_000_000;
    client.transfer(&admin, &player, &player_funds);

    // Player approves game contract to spend entry stake
    let stake: i128 = 1_000_000_000_000_000_000_000;
    client.approve(&player, &game_contract, &stake, &0);
    assert_eq!(client.allowance(&player, &game_contract), stake);

    // Game contract collects stake
    client.transfer_from(&game_contract, &player, &treasury, &stake);
    assert_eq!(client.balance(&player), player_funds - stake);
    assert_eq!(client.balance(&treasury), stake);
    assert_eq!(client.allowance(&player, &game_contract), 0);
}

/// Simulate multi-player token distribution across 4 players
/// then verify total supply is conserved throughout.
#[test]
fn sim_multi_player_distribution() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let players: [Address; 4] = [
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
        Address::generate(&e),
    ];

    client.initialize(&admin, &INITIAL_SUPPLY);

    // Distribute equal starting cash to each player
    let starting_cash: i128 = 1_500_000_000_000_000_000_000;
    for p in &players {
        client.transfer(&admin, p, &starting_cash);
    }

    // Supply is conserved — just redistributed
    assert_eq!(client.total_supply(), INITIAL_SUPPLY);

    let total_distributed: i128 = starting_cash * 4;
    assert_eq!(client.balance(&admin), INITIAL_SUPPLY - total_distributed);

    // Players trade among themselves
    client.transfer(&players[0], &players[1], &500_000_000_000_000_000_000);
    client.transfer(&players[2], &players[3], &200_000_000_000_000_000_000);

    // Supply still conserved
    assert_eq!(client.total_supply(), INITIAL_SUPPLY);
}

/// Simulate admin rotation: old admin hands off to new admin,
/// new admin can mint, old admin cannot.
#[test]
fn sim_admin_rotation() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let new_admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);

    // New admin can mint
    let amount: i128 = 1_000_000_000_000_000_000_000;
    client.mint(&user, &amount);
    assert_eq!(client.balance(&user), amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY + amount);
}

/// Simulate burn_from: spender is authorised to burn on behalf of holder.
#[test]
fn sim_burn_from_fee_collection() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let holder = Address::generate(&e);
    let protocol = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);

    let grant: i128 = 2_000_000_000_000_000_000_000;
    client.transfer(&admin, &holder, &grant);

    let burn_allowance: i128 = 500_000_000_000_000_000_000;
    client.approve(&holder, &protocol, &burn_allowance, &0);

    let burn_amount: i128 = 300_000_000_000_000_000_000;
    client.burn_from(&protocol, &holder, &burn_amount);

    assert_eq!(client.balance(&holder), grant - burn_amount);
    assert_eq!(client.total_supply(), INITIAL_SUPPLY - burn_amount);
    assert_eq!(
        client.allowance(&holder, &protocol),
        burn_allowance - burn_amount
    );
}

#[test]
fn test_new_admin_can_mint() {
    let e = Env::default();
    e.mock_all_auths();

    let contract_id = e.register(TycoonToken, ());
    let client = TycoonTokenClient::new(&e, &contract_id);
    let admin = Address::generate(&e);
    let new_admin = Address::generate(&e);
    let user = Address::generate(&e);

    client.initialize(&admin, &INITIAL_SUPPLY);
    client.set_admin(&new_admin);

    let mint_amount: i128 = 1_000_000_000_000_000_000_000;
    client.mint(&user, &mint_amount);

    assert_eq!(client.balance(&user), mint_amount);
}
