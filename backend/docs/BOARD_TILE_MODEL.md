# Board Tile Model

Server-authoritative ruleset for the Tycoon board tile engine. This document is the
source of truth for tile behavior; the backend encodes these rules in a pure module
(`backend/src/games/board-tile-model.ts`) that is consumed by HTTP and WS actions.
Clients never finalize economic outcomes — they render server quotes/results only.

## Ruleset pinning

- Every game row stores `rulesetVersion` and `rulesetHash`.
- The hash is computed from the canonical serialization of the ruleset constants
  below. Any change to a constant MUST bump the version and hash.
- Actions are validated against the ruleset pinned on the game row; client-supplied
  constants (dice, prices, rent tables) are ignored.

## Tile families

| Family   | Behavior                                                        |
|----------|-----------------------------------------------------------------|
| GO       | Award `GO_SALARY` when passing or landing.                      |
| PROPERTY | Buyable; rent scales with houses/hotel per `RENT_TABLE`.        |
| RAILROAD | Buyable; rent scales with owned count per `RAILROAD_RENT`.      |
| UTILITY  | Buyable; rent = dice roll × multiplier per `UTILITY_MULTIPLIER`.|
| TAX      | Debit `TAX_AMOUNT` to the bank.                                 |
| CHANCE   | Draw from `CHANCE_DECK`; effects applied server-side.           |
| JAIL     | Enter/exit per `JAIL_RULES`.                                     |
| FREE     | No-op.                                                          |

## Economic rules

- Money mutations are transactional: debit and credit commit atomically or not at all.
- Bankruptcy mid-debt: if a player cannot cover a debit, the server marks them
  bankrupt, transfers assets to the creditor (or bank), and emits `PLAYER_BANKRUPT`.
- House builds require a monopoly on the color group. Illegal builds are rejected
  with `ILLEGAL_HOUSE_BUILD` and no state change.
- Trades are accepted idempotently by `tradeId`; a stale accept (already accepted,
  cancelled, or expired) is rejected with `STALE_TRADE_ACCEPT`.
- Simultaneous actions are serialized per game via a transactional lock; the loser
  of a race receives `CONFLICT_RETRY` and may retry idempotently.

## Events

Every accepted mutation emits a game event for replay:
`MONEY_MOVED`, `PROPERTY_TRANSFERRED`, `HOUSE_BUILT`, `TRADE_ACCEPTED`,
`PLAYER_BANKRUPT`, `TURN_ADVANCED`. Replaying the event log MUST rebuild identical
state (see `backend/test/games-replay.e2e-spec.ts`).

## Prize claims

Only the winner may claim the prize; claims are idempotent by `gameId` and rejected
with `NOT_WINNER` for non-winners and `ALREADY_CLAIMED` for duplicates.

## Failure modes

- Dependency outage (Postgres/Redis/shop-api/RPC): writes fail closed.
- Auth expiry mid-flow: action rejected with `UNAUTHENTICATED`; no partial mutation.
- Adversarial input: enum values validated, payloads size-capped, spoofed events
  rejected by signature/ownership checks.

## Chain note

NEAR wallet is the only supported chain UI per ADR-003 until Stellar is gated ready.
Do not surface Stellar-specific copy in board tile flows.
