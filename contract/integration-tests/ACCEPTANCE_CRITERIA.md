# Integration Tests - Acceptance Criteria

## Overview
This document defines the acceptance criteria for Soroban contract integration tests as part of the Stellar Wave engineering batch (SW-CONTRACT-001).

## Test Scope

### 1. Cross-Contract Integration Tests
**File**: `tests/cross_contract_integration.rs`

#### AC1.1: Token Contract Initialization
- [ ] TYC token contract initializes successfully
- [ ] USDC token contract initializes successfully
- [ ] Token metadata is correctly set (name, symbol, decimals)
- [ ] Admin can mint tokens to contract addresses

#### AC1.2: Game Contract Initialization with Token References
- [ ] Game contract initializes with valid TYC token address
- [ ] Game contract initializes with valid USDC token address
- [ ] Game contract stores correct reward system address
- [ ] Game contract owner is correctly set

#### AC1.3: Collectibles Contract Initialization
- [ ] Collectibles contract initializes with valid admin
- [ ] Shop can be initialized with valid collectible definitions
- [ ] Collectibles contract can reference game contract

#### AC1.4: Reward System Initialization
- [ ] Reward system initializes with valid token addresses
- [ ] Reward system can reference game and collectibles contracts

### 2. Token Interaction Tests
**File**: `tests/token_interactions.rs`

#### AC2.1: Cross-Contract Token Transfers
- [ ] Game contract can transfer TYC tokens to players
- [ ] Game contract can transfer USDC tokens to players
- [ ] Token balances are correctly updated after transfers
- [ ] Transfer events are emitted with correct data

#### AC2.2: Token Allowances and Approvals
- [ ] Game contract can approve token spending
- [ ] Reward system can spend approved tokens
- [ ] Allowance decreases after spending
- [ ] Spending without approval fails appropriately

#### AC2.3: Token Minting and Burning
- [ ] Admin can mint tokens to game contract
- [ ] Game contract can burn tokens (if applicable)
- [ ] Total supply is correctly updated
- [ ] Mint/burn events are emitted

### 3. Game Flow Integration Tests
**File**: `tests/game_flow.rs`

#### AC3.1: Player Registration Flow
- [ ] Player can register in game contract
- [ ] Player receives initial cash allocation
- [ ] Player data is stored correctly
- [ ] Duplicate registration is prevented

#### AC3.2: Game Creation and Joining
- [ ] Owner can create a new game
- [ ] Players can join existing games
- [ ] Game state transitions correctly (pending → active → completed)
- [ ] Game capacity limits are enforced

#### AC3.3: Game Completion and Rewards
- [ ] Game can transition to completed state
- [ ] Winner is correctly identified
- [ ] Reward tokens are transferred to winner
- [ ] Game history is recorded

#### AC3.4: Collectibles Integration in Game
- [ ] Players can purchase collectibles during game
- [ ] Collectible ownership is transferred correctly
- [ ] Cash is deducted from player account
- [ ] Collectible events are emitted

### 4. Reward System Integration Tests
**File**: `tests/reward_system_integration.rs`

#### AC4.1: Voucher Creation and Management
- [ ] Reward system can create vouchers
- [ ] Vouchers store correct token and amount
- [ ] Voucher metadata is accessible
- [ ] Multiple vouchers can coexist

#### AC4.2: Reward Distribution
- [ ] Game contract can trigger reward distribution
- [ ] Correct tokens are transferred to players
- [ ] Reward amounts are accurate
- [ ] Reward events are emitted

#### AC4.3: Multi-Token Support
- [ ] Reward system handles TYC tokens
- [ ] Reward system handles USDC tokens
- [ ] Token balances are tracked separately
- [ ] Cross-token operations work correctly

#### AC4.4: Reward System Authorization
- [ ] Only authorized contracts can trigger rewards
- [ ] Unauthorized calls are rejected
- [ ] Admin can update authorized contracts
- [ ] Authorization changes are logged

## Test Execution Requirements

### Build Requirements
- [ ] `cargo check` passes for all workspace members
- [ ] `cargo build --target wasm32-unknown-unknown --release` succeeds
- [ ] No compiler warnings in contract code
- [ ] WASM artifacts are generated correctly

### Test Requirements
- [ ] All integration tests pass: `cargo test --test '*' --all`
- [ ] Unit tests continue to pass: `cargo test --lib --all`
- [ ] Test coverage includes happy path and error cases
- [ ] Tests use proper Soroban testutils patterns
- [ ] Mock authentication is used appropriately

### CI/CD Requirements
- [ ] GitHub Actions workflow runs all tests
- [ ] CI passes for all affected packages
- [ ] Build artifacts are generated
- [ ] No flaky tests (deterministic results)

## Documentation Requirements

### Code Documentation
- [ ] Each test function has clear purpose comments
- [ ] Test helpers are documented with usage examples
- [ ] Complex test scenarios are explained
- [ ] Error cases are documented

### PR Requirements
- [ ] PR references Stellar Wave issue (e.g., SW-CONTRACT-001)
- [ ] PR body documents rollout/migration steps
- [ ] PR body lists all acceptance criteria met
- [ ] PR body includes test execution results

## Security Requirements

### No Unaudited Patterns
- [ ] No privileged patterns without security review
- [ ] No oracle integrations without documentation
- [ ] Authorization checks are properly tested
- [ ] Access control is enforced in tests

### Best Practices
- [ ] Follows Stellar/Soroban best practices
- [ ] Uses safe math operations
- [ ] Proper error handling in all paths
- [ ] Events are emitted for all state changes

## Test Data and Fixtures

### Standard Test Setup
- [ ] Test environment uses `Env::default()`
- [ ] Mock authentication with `env.mock_all_auths()`
- [ ] Standard token amounts: 1,000,000 units
- [ ] Standard player count: 2-4 players per game
- [ ] Standard game duration: 100 ledger blocks

### Test Addresses
- [ ] Owner address: `Address::generate(env)`
- [ ] Player addresses: Generated per test
- [ ] Admin addresses: Generated per contract
- [ ] Contract addresses: Registered with `env.register()`

## Success Criteria

All acceptance criteria must be met for PR approval:
1. ✅ All integration tests pass
2. ✅ `cargo check` passes
3. ✅ CI/CD pipeline is green
4. ✅ Documentation is complete
5. ✅ PR references Stellar Wave issue
6. ✅ No security concerns identified
7. ✅ Code follows Soroban best practices

## Related Issues
- Stellar Wave: SW-CONTRACT-001
- Task: Improve integration-tests on Stellar Soroban contracts and tooling
