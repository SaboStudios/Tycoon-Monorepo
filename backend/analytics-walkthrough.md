# Perk Usage Analytics Implementation

Implemented a comprehensive analytics system to track perk usage, revenue, and win-rate impact.

## Components

### 1. PerkAnalyticsEvent Entity
Tracks individual events related to perks:
- **PURCHASE**: When a player acquires a perk (tracks revenue).
- **ACTIVATION**: When a player activates a perk in a game.
- **USAGE**: When a perk's effect is actually applied (e.g., landing on a property).
- **EXPIRATION**: When a perk's boost expires.

### 2. PerkAnalyticsService
Handles event logging and provides complex metrics:
- **Most Used Perks**: Aggregates activation counts.
- **Revenue per Perk**: Sums up revenue from purchase events.
- **Win-Rate Impact**: Calculates the win rate for players when a specific perk was active, compared to game outcomes.

### 3. PerksAnalyticsController
Provides dashboard-ready endpoints:
- `GET /perks/analytics/dashboard`: Summary of all metrics.
- `GET /perks/analytics/most-used`: Rankings of perks by usage.
- `GET /perks/analytics/revenue`: Revenue breakdown.
- `GET /perks/analytics/win-rate`: Performance impact analysis.
- `GET /perks/analytics/export`: JSON report export.

## Integration
- **BoostActivationService**: Now logs activation events.
- **InventoryService**: Now logs purchase/grant events with revenue calculation.
- **BoostLifecycleService**: Now logs expiration events.

## Scalability
The system uses a dedicated `perk_analytics_events` table designed for high-volume event logging, keeping business logic tables clean while providing rich data for analysis.
