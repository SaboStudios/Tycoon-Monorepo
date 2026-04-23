# Integration Test Scenarios

## Detailed Test Scenario Documentation

This document provides detailed descriptions of each integration test scenario, including setup, execution, and expected outcomes.

---

## 1. Cross-Contract Integration Tests

### Scenario 1.1: Complete Contract Ecosystem Initialization

**Purpose**: Verify that all contracts can be initialized together and maintain correct references.

**Setup**:
1. Create test environment with `Env::default()`
2. Mock all authentications
3. Generate admin and owner addresses

**Execution**:
1. Initialize TYC token contract
2. Initialize USDC token contract
3. Initialize game contract with token addresses
4. Initialize collectibles contract
5. Initialize reward system contract

**Expected Outcomes**:
- All contracts initialize without errors
- Token contracts have correct metadata
- Game contract stores correct token addresses
- Collectibles contract has valid admin
- Reward system has correct contract references
- No events are emitted during initialization

**Error Cases**:
- Initialization with invalid addresses should fail
- Double initialization should panic
- Missing required parameters should fail

**Assertions**:
```rust
assert_eq!(token_client.name(), "Tycoon Token");
assert_eq!(game_client.get_owner(), owner);
assert_eq!(collectibles_client.get_admin(), admin);
```

---

### Scenario 1.2: Contract Address Validation

**Purpose**: Verify that contracts correctly validate and store cross-contract addresses.

**Setup**:
1. Initialize all contracts
2. Generate test addresses

**Execution**:
1. Query game contract for stored token addresses
2. Query reward system for stored contract addresses
3. Verify address types and formats

**Expected Outcomes**:
- Stored addresses match initialized addresses
- Addresses are in correct format
- Address queries return consistent results
- No address mutations occur

**Error Cases**:
- Querying non-existent addresses should fail
- Invalid address formats should be rejected

---

## 2. Token Interaction Tests

### Scenario 2.1: Token Transfer Flow

**Purpose**: Verify that tokens can be transferred between contracts and players.

**Setup**:
1. Initialize token and game contracts
2. Mint tokens to game contract
3. Generate player addresses

**Execution**:
1. Game contract transfers TYC tokens to player
2. Query player balance
3. Query game contract balance
4. Verify transfer event

**Expected Outcomes**:
- Player balance increases by transfer amount
- Game contract balance decreases by transfer amount
- Transfer event is emitted with correct data
- Total supply remains constant

**Test Data**:
- Initial game balance: 1,000,000 TYC
- Transfer amount: 100,000 TYC
- Expected player balance: 100,000 TYC
- Expected game balance: 900,000 TYC

**Assertions**:
```rust
assert_eq!(token_client.balance(&player), 100_000);
assert_eq!(token_client.balance(&game_contract), 900_000);
assert_eq!(events.len(), 1);
assert_eq!(events[0].topics[0], Symbol::new(&env, "transfer"));
```

---

### Scenario 2.2: Token Approval and Spending

**Purpose**: Verify that token approvals work correctly and allowances decrease after spending.

**Setup**:
1. Initialize token and game contracts
2. Mint tokens to game contract
3. Generate spender address

**Execution**:
1. Game contract approves spender for 500,000 tokens
2. Spender transfers 200,000 tokens
3. Query remaining allowance
4. Attempt to spend more than allowance (should fail)

**Expected Outcomes**:
- Initial allowance is 500,000
- After spending 200,000, allowance is 300,000
- Spending more than allowance fails
- Approval events are emitted

**Test Data**:
- Approval amount: 500,000 tokens
- First spend: 200,000 tokens
- Second spend attempt: 400,000 tokens (should fail)

**Assertions**:
```rust
assert_eq!(token_client.allowance(&game_contract, &spender), 300_000);
// Spending more than allowance should panic
```

---

### Scenario 2.3: Multi-Token Transfers

**Purpose**: Verify that game contract can handle both TYC and USDC tokens.

**Setup**:
1. Initialize both token contracts
2. Initialize game contract
3. Mint both tokens to game contract
4. Generate player address

**Execution**:
1. Transfer TYC tokens to player
2. Transfer USDC tokens to same player
3. Query both balances
4. Verify both transfer events

**Expected Outcomes**:
- Player has correct TYC balance
- Player has correct USDC balance
- Both transfer events are emitted
- Token balances are tracked separately

**Test Data**:
- TYC transfer: 100,000 units
- USDC transfer: 50,000 units (different decimals)

**Assertions**:
```rust
assert_eq!(tyc_client.balance(&player), 100_000);
assert_eq!(usdc_client.balance(&player), 50_000);
assert_eq!(events.len(), 2);
```

---

## 3. Game Flow Integration Tests

### Scenario 3.1: Player Registration Flow

**Purpose**: Verify that players can register and receive initial cash allocation.

**Setup**:
1. Initialize game contract
2. Initialize token contracts
3. Mint tokens to game contract
4. Generate player address

**Execution**:
1. Player registers in game
2. Query player data
3. Query player cash balance
4. Verify registration event

**Expected Outcomes**:
- Player is registered successfully
- Player data is stored correctly
- Player receives initial cash (1,000,000 units)
- Registration event is emitted
- Duplicate registration is prevented

**Test Data**:
- Initial cash: 1,000,000 units
- Player name: "Player1"

**Assertions**:
```rust
let player_data = game_client.get_player(&player);
assert_eq!(player_data.cash, 1_000_000);
assert_eq!(player_data.name, "Player1");
```

---

### Scenario 3.2: Game Creation and State Transitions

**Purpose**: Verify that games can be created and transition through states correctly.

**Setup**:
1. Initialize game contract
2. Register multiple players
3. Generate owner address

**Execution**:
1. Owner creates a new game
2. Query game state (should be "pending")
3. Players join the game
4. Query game state (should be "active")
5. Complete the game
6. Query game state (should be "completed")

**Expected Outcomes**:
- Game is created with correct ID
- Initial state is "pending"
- State transitions to "active" when players join
- State transitions to "completed" when game ends
- Game history is recorded
- Game events are emitted for each state change

**Test Data**:
- Game ID: Auto-generated
- Player count: 3 players
- Game duration: 100 blocks

**Assertions**:
```rust
assert_eq!(game_client.get_game_state(&game_id), "pending");
// After players join
assert_eq!(game_client.get_game_state(&game_id), "active");
// After completion
assert_eq!(game_client.get_game_state(&game_id), "completed");
```

---

### Scenario 3.3: Game Completion and Reward Distribution

**Purpose**: Verify that games complete correctly and rewards are distributed to winners.

**Setup**:
1. Initialize game and token contracts
2. Create and populate a game with players
3. Mint reward tokens

**Execution**:
1. Play game to completion
2. Determine winner
3. Distribute rewards
4. Query winner balance
5. Verify reward event

**Expected Outcomes**:
- Winner is correctly identified
- Reward tokens are transferred to winner
- Winner balance increases by reward amount
- Reward event is emitted with correct data
- Game history records the winner

**Test Data**:
- Reward amount: 500,000 units
- Winner: Player with highest score

**Assertions**:
```rust
assert_eq!(game_client.get_game_winner(&game_id), winner);
assert_eq!(token_client.balance(&winner), 500_000);
```

---

### Scenario 3.4: Collectibles Purchase During Game

**Purpose**: Verify that players can purchase collectibles and ownership transfers correctly.

**Setup**:
1. Initialize game and collectibles contracts
2. Register players
3. Create game
4. Initialize shop with collectibles
5. Mint tokens to players

**Execution**:
1. Player purchases collectible
2. Query player cash (should decrease)
3. Query player collectibles (should increase)
4. Query collectible owner
5. Verify purchase event

**Expected Outcomes**:
- Player cash decreases by collectible price
- Player collectible count increases
- Collectible ownership is transferred
- Purchase event is emitted
- Collectible metadata is accessible

**Test Data**:
- Collectible price: 100,000 units
- Player initial cash: 1,000,000 units
- Expected cash after purchase: 900,000 units

**Assertions**:
```rust
assert_eq!(game_client.get_player_cash(&player), 900_000);
assert_eq!(collectibles_client.get_owner(&collectible_id), player);
```

---

## 4. Reward System Integration Tests

### Scenario 4.1: Voucher Creation and Management

**Purpose**: Verify that reward system can create and manage vouchers.

**Setup**:
1. Initialize reward system contract
2. Initialize token contracts
3. Generate admin address

**Execution**:
1. Create voucher with TYC token
2. Query voucher data
3. Create another voucher with USDC
4. Query both vouchers
5. Verify voucher events

**Expected Outcomes**:
- Vouchers are created successfully
- Voucher data is stored correctly
- Multiple vouchers can coexist
- Voucher metadata is accessible
- Voucher creation events are emitted

**Test Data**:
- Voucher 1: 100,000 TYC
- Voucher 2: 50,000 USDC

**Assertions**:
```rust
let voucher1 = reward_client.get_voucher(&voucher_id_1);
assert_eq!(voucher1.amount, 100_000);
assert_eq!(voucher1.token, tyc_token);
```

---

### Scenario 4.2: Reward Distribution Flow

**Purpose**: Verify that rewards can be distributed to players correctly.

**Setup**:
1. Initialize reward system and token contracts
2. Create vouchers
3. Mint tokens to reward system
4. Generate player addresses

**Execution**:
1. Trigger reward distribution
2. Query player balances
3. Query reward system balance
4. Verify distribution events

**Expected Outcomes**:
- Tokens are transferred to players
- Player balances increase correctly
- Reward system balance decreases
- Distribution events are emitted
- Reward history is recorded

**Test Data**:
- Reward per player: 100,000 units
- Player count: 3
- Total distributed: 300,000 units

**Assertions**:
```rust
assert_eq!(token_client.balance(&player1), 100_000);
assert_eq!(token_client.balance(&player2), 100_000);
assert_eq!(token_client.balance(&player3), 100_000);
```

---

### Scenario 4.3: Multi-Token Reward Support

**Purpose**: Verify that reward system handles multiple token types correctly.

**Setup**:
1. Initialize reward system with both tokens
2. Create vouchers for both tokens
3. Mint both tokens to reward system

**Execution**:
1. Distribute TYC rewards
2. Distribute USDC rewards
3. Query player balances for both tokens
4. Verify separate tracking

**Expected Outcomes**:
- TYC rewards are distributed correctly
- USDC rewards are distributed correctly
- Token balances are tracked separately
- Cross-token operations work correctly
- Both token events are emitted

**Test Data**:
- TYC reward: 100,000 units
- USDC reward: 50,000 units

**Assertions**:
```rust
assert_eq!(tyc_client.balance(&player), 100_000);
assert_eq!(usdc_client.balance(&player), 50_000);
```

---

### Scenario 4.4: Authorization and Access Control

**Purpose**: Verify that only authorized contracts can trigger rewards.

**Setup**:
1. Initialize reward system
2. Set authorized contracts
3. Generate unauthorized address

**Execution**:
1. Authorized contract triggers reward distribution (should succeed)
2. Unauthorized address attempts to trigger distribution (should fail)
3. Admin updates authorized contracts
4. Verify authorization changes

**Expected Outcomes**:
- Authorized contracts can trigger rewards
- Unauthorized calls are rejected
- Authorization can be updated by admin
- Authorization changes are logged
- Proper error messages for unauthorized access

**Error Cases**:
- Unauthorized contract should panic with "Unauthorized"
- Invalid authorization updates should fail

**Assertions**:
```rust
// Authorized call should succeed
reward_client.distribute_rewards(&game_contract, &players);

// Unauthorized call should panic
// reward_client.distribute_rewards(&unauthorized_address, &players);
```

---

## Test Execution Order

Tests should be executed in the following order to ensure proper setup:

1. **Cross-Contract Integration** - Establishes baseline contract setup
2. **Token Interactions** - Verifies token mechanics
3. **Game Flow** - Tests game lifecycle
4. **Reward System Integration** - Tests reward distribution

This order ensures that foundational tests pass before more complex integration scenarios.

---

## Performance Considerations

### Test Execution Time
- Individual tests should complete in < 100ms
- Full test suite should complete in < 5 seconds
- No tests should timeout

### Resource Usage
- Memory usage should be minimal (< 100MB)
- No memory leaks in test environment
- Proper cleanup after each test

### Determinism
- All tests should produce consistent results
- No flaky tests or race conditions
- Deterministic random number generation (if applicable)

---

## Debugging Failed Tests

### Common Issues and Solutions

**"Contract already initialized"**
- Ensure `env.mock_all_auths()` is called
- Check that setup functions aren't called twice
- Verify test isolation

**"Insufficient balance"**
- Verify tokens are minted before transfers
- Check transfer amounts
- Ensure balances are queried correctly

**"Event not found"**
- Verify events are emitted in contract
- Check event topics and data
- Ensure event verification is correct

**"Unauthorized"**
- Verify authorization is set up
- Check admin/owner addresses
- Ensure proper authentication mocking

### Debug Output

Run tests with output to see detailed logs:
```bash
cargo test --test '*' -- --nocapture
```

Enable Soroban logging:
```bash
SOROBAN_LOG=debug cargo test --test '*'
```

---

## Related Documentation

- [Acceptance Criteria](./ACCEPTANCE_CRITERIA.md)
- [README](./README.md)
- [Soroban Testing Guide](https://soroban.stellar.org/docs/learn/testing)
