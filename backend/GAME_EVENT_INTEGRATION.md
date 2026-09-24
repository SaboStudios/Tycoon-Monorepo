# Game Event Integration - Boost System Implementation

## Overview

This implementation integrates the perks/boosts system with the core gameplay engine, allowing boosts to dynamically affect game mechanics in real-time.

## Architecture

### Core Components

1. **BoostService** (`perks-boosts/services/boost.service.ts`)
   - Calculates modified values based on active boosts
   - Handles stacking rules (ADDITIVE, MULTIPLICATIVE, HIGHEST_ONLY)
   - Tracks boost usage and decrements consumables

2. **GamePlayersService** (`games/game-players.service.ts`)
   - Integrates boost calculations into gameplay actions
   - Emits events for boost system hooks
   - Manages player state with boost modifications

3. **PerksBoostsEvents** (`perks-boosts/services/perks-boosts-events.service.ts`)
   - Event bus for game-boost communication
   - Enables reactive boost activation

## Boost Integration Points

### 1. Dice Roll (Extra Dice Roll / Dice Modifier)

**Location**: `GamePlayersService.rollDice()`

**Hooks**:
- `BoostType.DICE_MODIFIER` - Modifies dice total before movement
- `BoostType.SPEED_BOOST` - Applies free movement bonuses

**Example**:
```typescript
let baseTotal = dice1 + dice2;
baseTotal = await this.boostService.calculateModifiedValue(
  { playerId, gameId, baseValue: baseTotal, metadata: { dice1, dice2 } },
  BoostType.DICE_MODIFIER
);
```

**Events Emitted**:
- `PerkBoostEvent.DICE_ROLLED` - After dice roll completes
- `PerkBoostEvent.PLAYER_LANDED` - When player lands on new position

### 2. Rent Calculation (Rent Reduction / Multiplier)

**Location**: `GamePlayersService.payRent()`

**Hooks**:
- `BoostType.RENT_MULTIPLIER` - Modifies rent amount (can increase or decrease)

**Example**:
```typescript
let finalRent = await this.boostService.calculateModifiedValue(
  { playerId: payee.user_id, gameId, baseValue: baseRent },
  BoostType.RENT_MULTIPLIER
);
```

**API Endpoint**: `POST /games/:gameId/players/:playerId/pay-rent`

### 3. Tax Payment (Tax Immunity / Reduction)

**Location**: `GamePlayersService.payTax()`

**Hooks**:
- `BoostType.TAX_REDUCTION` - Reduces tax amount (100% = immunity)

**Example**:
```typescript
const finalTax = await this.boostService.calculateModifiedValue(
  { playerId: player.user_id, gameId, baseValue: baseTax },
  BoostType.TAX_REDUCTION
);
```

**API Endpoint**: `POST /games/:gameId/players/:playerId/pay-tax`

### 4. Property Purchase

**Location**: `GamePlayersService.buyProperty()`

**Hooks**:
- Event emission for potential purchase-triggered boosts

**Events Emitted**:
- `PerkBoostEvent.PROPERTY_PURCHASE` - After successful purchase

**API Endpoint**: `POST /games/:gameId/players/:playerId/buy-property`

### 5. Double Income (Passing GO)

**Location**: `GamePlayersService.rollDice()` (when crossing position 0)

**Hooks**:
- `BoostType.CASH_REWARD` - Modifies GO bonus (200 → 400 for 2x)

**Example**:
```typescript
if (newPosition < oldPosition) {
  player.balance += await this.boostService.calculateModifiedValue(
    { playerId: player.user_id, gameId, baseValue: START_BONUS },
    BoostType.CASH_REWARD
  );
}
```

## Boost Priority Rules

The boost engine applies modifications in this order:

1. **ADDITIVE** boosts (flat additions/subtractions)
2. **MULTIPLICATIVE** boosts (percentage modifiers)
3. **HIGHEST_ONLY** boosts (only the strongest applies)

This ensures predictable and balanced boost stacking.

## API Endpoints

### Roll Dice
```http
POST /games/:gameId/players/:playerId/roll-dice
Content-Type: application/json

{
  "dice1": 3,
  "dice2": 4
}
```

### Pay Rent
```http
POST /games/:gameId/players/:playerId/pay-rent
Content-Type: application/json

{
  "payeeId": 2,
  "baseRent": 100
}
```

### Pay Tax
```http
POST /games/:gameId/players/:playerId/pay-tax
Content-Type: application/json

{
  "baseTax": 200
}
```

### Buy Property
```http
POST /games/:gameId/players/:playerId/buy-property
Content-Type: application/json

{
  "propertyId": 15,
  "propertyCost": 300
}
```

## Testing

### Test Coverage

All boost integrations are tested in `game-boost-integration.spec.ts`:

- ✅ Dice modifier boost application
- ✅ Speed boost (free movement)
- ✅ Double income on passing GO
- ✅ Rent multiplier boost
- ✅ Rent reduction boost
- ✅ Tax reduction boost
- ✅ Tax immunity (100% reduction)
- ✅ Property purchase event emission

### Running Tests

```bash
npm test game-boost-integration
```

**Result**: All 8 tests passing ✅

## Performance Considerations

1. **Database Queries**: Boost lookups use indexed queries on `user_id`, `game_id`, and `is_active`
2. **Caching**: Active boosts are fetched once per action
3. **Async Operations**: All boost calculations are non-blocking
4. **Event Bus**: Uses RxJS Subject for efficient event handling

## Acceptance Criteria

✅ **Accurate boost execution**
- All boost types correctly modify gameplay values
- Stacking rules properly enforced
- Consumable boosts decrement usage

✅ **No performance degradation**
- Minimal additional queries per action
- Indexed database lookups
- Efficient event emission
- Tests complete in <6 seconds

## Future Enhancements

1. **Boost Combos**: Special effects when multiple boosts are active
2. **Conditional Boosts**: Boosts that activate based on game state
3. **Boost Analytics**: Track boost effectiveness and usage patterns
4. **Boost Marketplace**: Trade boosts between players

## Dependencies

- `@nestjs/common` - NestJS framework
- `typeorm` - Database ORM
- `rxjs` - Event handling
- `class-validator` - DTO validation

## Module Structure

```
backend/src/modules/
├── games/
│   ├── game-players.service.ts (✨ Boost integration)
│   ├── games.controller.ts (✨ New endpoints)
│   ├── games.module.ts (imports PerksBoostsModule)
│   └── game-boost-integration.spec.ts (✨ Tests)
└── perks-boosts/
    ├── services/
    │   ├── boost.service.ts (Core boost engine)
    │   └── perks-boosts-events.service.ts (Event bus)
    └── enums/
        └── perk-boost.enums.ts (Boost types)
```

## Conclusion

The boost system is now fully integrated with the gameplay engine, providing dynamic, real-time modifications to game mechanics without performance degradation. All acceptance criteria have been met with comprehensive test coverage.
