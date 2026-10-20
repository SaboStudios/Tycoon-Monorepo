# Soroban Contract Integration Tests

## Overview

This directory contains comprehensive integration tests for the Tycoon Soroban smart contracts. These tests verify cross-contract interactions, token flows, and end-to-end game scenarios that cannot be adequately tested with unit tests alone.

**Part of**: Stellar Wave engineering batch (SW-CONTRACT-001)

## Test Structure

```
integration-tests/
├── Cargo.toml                          # Integration test workspace
├── README.md                           # This file
├── ACCEPTANCE_CRITERIA.md              # Detailed acceptance criteria
├── TEST_SCENARIOS.md                   # Test scenario documentation
└── tests/
    ├── cross_contract_integration.rs   # Contract initialization & setup
    ├── token_interactions.rs           # Token transfer & approval flows
    ├── game_flow.rs                    # Complete game lifecycle
    └── reward_system_integration.rs    # Reward distribution & vouchers
```

## Running Tests

### Run All Integration Tests
```bash
cd contract
cargo test --test '*' --all
```

### Run Specific Test Suite
```bash
# Cross-contract integration tests
cargo test --test cross_contract_integration

# Token interaction tests
cargo test --test token_interactions

# Game flow tests
cargo test --test game_flow

# Reward system tests
cargo test --test reward_system_integration
```

### Run with Output
```bash
cargo test --test '*' -- --nocapture
```

### Run Single Test
```bash
cargo test --test game_flow test_player_registration_flow -- --exact
```

## Test Scenarios

### 1. Cross-Contract Integration (`cross_contract_integration.rs`)

Tests the initialization and setup of all contracts working together:

- **Token Contract Setup**: Initializes TYC and USDC token contracts
- **Game Contract Setup**: Initializes game contract with token references
- **Collectibles Setup**: Initializes collectibles contract with shop
- **Reward System Setup**: Initializes reward system with all dependencies

**Key Assertions**:
- Contracts initialize without errors
- Addresses are correctly stored
- Admin/owner roles are properly set
- Cross-contract references are valid

### 2. Token Interactions (`token_interactions.rs`)

Tests token transfer, approval, and balance management:

- **Token Transfers**: Game contract transfers tokens to players
- **Allowances**: Contracts approve and spend tokens
- **Balance Tracking**: Balances update correctly after operations
- **Event Emission**: Transfer events contain correct data

**Key Assertions**:
- Balances match expected values
- Events are emitted with correct parameters
- Allowances decrease after spending
- Unauthorized transfers fail

### 3. Game Flow (`game_flow.rs`)

Tests complete game lifecycle from registration to completion:

- **Player Registration**: Players register and receive initial cash
- **Game Creation**: Owner creates games with proper state
- **Game Joining**: Players join games and state updates
- **Game Completion**: Games complete and rewards are distributed
- **Collectibles Purchase**: Players buy collectibles during game

**Key Assertions**:
- Player data is stored correctly
- Game state transitions are valid
- Cash allocations are accurate
- Collectible ownership transfers work
- Rewards are distributed to winners

### 4. Reward System Integration (`reward_system_integration.rs`)

Tests reward creation, management, and distribution:

- **Voucher Creation**: Reward system creates vouchers with correct data
- **Reward Distribution**: Tokens are transferred to players
- **Multi-Token Support**: Both TYC and USDC are handled
- **Authorization**: Only authorized contracts can trigger rewards

**Key Assertions**:
- Vouchers store correct amounts and tokens
- Reward distribution is accurate
- Token balances are updated
- Authorization is enforced

## Test Patterns and Best Practices

### Environment Setup
```rust
let env = Env::default();
env.mock_all_auths();  // Mock all authentication for testing
```

### Contract Registration
```rust
let contract_id = env.register(TycoonContract, ());
let client = TycoonContractClient::new(&env, &contract_id);
```

### Token Contract Creation
```rust
let token_contract = env.register_stellar_asset_contract_v2(&admin);
let token_address = token_contract.address();
let token_client = TokenClient::new(&env, &token_address);
```

### Event Verification
```rust
let events = env.events().all();
assert_eq!(events.len(), 1);
assert_eq!(events[0].topics[0], Symbol::new(&env, "transfer"));
```

### Error Testing
```rust
#[test]
#[should_panic(expected = "error message")]
fn test_error_case() {
    // Test code that should panic
}
```

## Acceptance Criteria

All tests must meet the following criteria:

### Build Requirements
- ✅ `cargo check` passes for all workspace members
- ✅ `cargo build --target wasm32-unknown-unknown --release` succeeds
- ✅ No compiler warnings

### Test Requirements
- ✅ All integration tests pass
- ✅ Unit tests continue to pass
- ✅ Tests cover happy path and error cases
- ✅ Tests use proper Soroban testutils patterns

### CI/CD Requirements
- ✅ GitHub Actions workflow runs all tests
- ✅ CI passes for all affected packages
- ✅ No flaky tests

### Documentation Requirements
- ✅ Each test has clear purpose comments
- ✅ Test helpers are documented
- ✅ Complex scenarios are explained
- ✅ PR references Stellar Wave issue

## Security Considerations

### Authorization Testing
- Tests verify that only authorized contracts can perform sensitive operations
- Admin/owner roles are properly enforced
- Unauthorized calls are rejected with appropriate errors

### No Unaudited Patterns
- No privileged patterns without security review
- No oracle integrations without documentation
- All access control is properly tested

### Best Practices
- Follows Stellar/Soroban best practices
- Uses safe math operations
- Proper error handling in all paths
- Events are emitted for all state changes

## Test Data Standards

### Standard Amounts
- Initial player cash: 1,000,000 units
- Token mint amount: 10,000,000 units
- Collectible price: 100,000 units

### Standard Addresses
- Owner: `Address::generate(env)`
- Players: Generated per test
- Admins: Generated per contract
- Contracts: Registered with `env.register()`

### Standard Game Setup
- Player count: 2-4 players
- Game duration: 100 ledger blocks
- Reward pool: 500,000 units

## Troubleshooting

### Test Failures

**"Contract already initialized"**
- Ensure `env.mock_all_auths()` is called before initialization
- Check that setup functions aren't called twice

**"Insufficient balance"**
- Verify tokens are minted before transfers
- Check that amounts are correct

**"Unauthorized"**
- Ensure proper authorization is set up
- Verify admin/owner addresses are correct

**"Event not found"**
- Check that events are emitted in the contract
- Verify event topics and data match expectations

### Build Issues

**WASM compilation fails**
- Ensure `wasm32-unknown-unknown` target is installed: `rustup target add wasm32-unknown-unknown`
- Check Rust version: `rustup update`
- Verify dependencies are correct in Cargo.toml

**Dependency conflicts**
- Run `cargo update` to resolve versions
- Check workspace resolver is set to "2"

## Contributing

When adding new integration tests:

1. Create a new test file in `tests/` directory
2. Follow existing test patterns and naming conventions
3. Add comprehensive comments explaining test purpose
4. Update `ACCEPTANCE_CRITERIA.md` with new criteria
5. Update this README with new test scenarios
6. Ensure all tests pass locally before submitting PR
7. Reference Stellar Wave issue in PR (e.g., SW-CONTRACT-001)

## Related Documentation

- [Acceptance Criteria](./ACCEPTANCE_CRITERIA.md) - Detailed acceptance criteria
- [Test Scenarios](./TEST_SCENARIOS.md) - Detailed test scenario documentation
- [Soroban Documentation](https://soroban.stellar.org/docs)
- [Soroban SDK Rust Docs](https://docs.rs/soroban-sdk/latest/soroban_sdk/)

## References

- **Stellar Wave**: SW-CONTRACT-001
- **Task**: Improve integration-tests on Stellar Soroban contracts and tooling
- **Scope**: Documentation and acceptance criteria
