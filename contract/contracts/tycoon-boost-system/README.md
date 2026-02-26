# Tycoon Boost System

## Overview
Smart contract implementing boost stacking rules for the Tycoon game.

## Boost Types

### 1. Additive Boosts
- **Stacking**: Values add together
- **Example**: +10% + +5% = +15%
- **Use Case**: Temporary buffs, event bonuses

### 2. Multiplicative Boosts
- **Stacking**: Values multiply together
- **Example**: 1.5x * 1.2x = 1.8x
- **Use Case**: Property upgrades, permanent bonuses

### 3. Override Boosts
- **Stacking**: Only highest priority applies
- **Example**: Priority 10 (3x) overrides Priority 5 (2x)
- **Use Case**: Special events, VIP status

## Stacking Rules

**Priority Order:**
1. Override boosts (highest priority wins)
2. Multiplicative boosts (all multiply together)
3. Additive boosts (all add together)

**Formula:**
```
If Override exists:
  Result = Override.value

Else:
  Result = Base * (Multiplicative₁ * Multiplicative₂ * ...) * (1 + Additive₁ + Additive₂ + ...)
```

## Values
All values are in basis points (10000 = 100%)
- 10000 = 1.0x (100%)
- 15000 = 1.5x (150%)
- 1000 = +10%

## Deterministic Outcomes
- Same input always produces same output
- Order of boost application doesn't matter within same type
- Priority resolves conflicts for Override type
