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

## Chance / Community RNG auditability

Chance and Community Chest draws are server-only and fully auditable. The deck
order is never trusted from the client; the server derives each draw from a
committed seed and records the draw so any game can be replayed and audited.

### Deck model

- `CHANCE_DECK` and `COMMUNITY_DECK` are ordered arrays of card ids defined in the
  pure module. Each card id maps to a deterministic effect (money move, move-to
  tile, jail, get-out-of-jail, per-player debit/credit, etc.).
- The deck is shuffled server-side at game start using a seed derived from the
  game's `rulesetHash` and a server-held `rngSeed`. The seed is stored on the game
  row and never exposed to clients.
- Draws advance a per-deck cursor. When the cursor reaches the end of the deck the
  server reshuffles deterministically from the same seed lineage and emits
  `DECK_RESHUFFLED`.

### Draw rules

1. **Server-only draw** — only the server may draw. A client-supplied card id,
   deck index, or seed is ignored; the server draws from its own cursor.
2. **Deterministic** — given the same `rngSeed`, `rulesetHash`, and draw sequence,
   the server produces the identical card sequence. This is what makes replay
   equality possible.
3. **Auditable** — every draw emits `CARD_DRAWN` with `{ deck, cardId, cursor,
   rulesetVersion }`. The event carries no seed material.
4. **Idempotent** — a draw is keyed by `(gameId, turnId, deck)`; a duplicate draw
   request for the same turn is rejected with `DUPLICATE_DRAW` and no state change.
5. **Transactional** — the card effect (money/property mutation) and the
   `CARD_DRAWN` event commit atomically or not at all.
6. **Fail-closed** — if the RNG seed is missing or the deck is exhausted without a
   valid reshuffle, the draw is rejected with `RNG_UNAVAILABLE` and no mutation.

### Events

Chance/Community draws emit `CARD_DRAWN` and, on wrap, `DECK_RESHUFFLED`.
Replaying these events together with the money/property events MUST rebuild an
identical board state and identical deck cursors.

### Golden vectors

Table-driven vectors in `backend/test/chance-rng.audit-spec.ts` cover:

- a full deck traversal producing the exact expected card sequence for a fixed
  `rngSeed` and `rulesetHash`;
- reshuffle wrap producing the expected `DECK_RESHUFFLED` event and continued
  sequence;
- duplicate draw for the same `(gameId, turnId, deck)` rejected with
  `DUPLICATE_DRAW`;
- client-supplied card id / seed ignored (server draw wins);
- missing seed rejected with `RNG_UNAVAILABLE` and no state change.

Vectors assert both the drawn card and the emitted event sequence.

## Trade offers

Trade offers are server-authoritative and expire deterministically. The offer
lifecycle and accept rules are encoded in the pure module and consumed by the
HTTP/WS trade actions; clients never finalize a trade.

### Offer lifecycle

- An offer is created with `tradeId`, `gameId`, `fromPlayerId`, `toPlayerId`,
  `give`/`receive` asset sets, and an `expiresAt` derived server-side from
  `TRADE_OFFER_TTL_MS` and the server clock. A client-supplied `expiresAt` is
  ignored.
- An offer is `OPEN` until it is accepted, cancelled, or expires. Expiry is
  evaluated server-side against the pinned ruleset and the server clock; a client
  clock is never trusted.
- Only the addressed `toPlayerId` may accept; any other actor is rejected with
  `NOT_TRADE_RECIPIENT` and no state change.

### Atomic accept rules

1. **Server-only finalization** — only the server may accept. Client-supplied
   asset sets, prices, or `expiresAt` are ignored; the server re-reads the offer
   from its own store.
2. **Expiry check** — if `now >= expiresAt`, the accept is rejected with
   `TRADE_EXPIRED` and no state change. Expiry is checked inside the same
   transaction that applies the trade so a race cannot slip past it.
3. **Idempotent** — an accept is keyed by `(gameId, tradeId)`. A duplicate accept
   (concurrent request or reconnect retry) returns the original result and MUST NOT
   double-apply assets. A repeat accept of an already-accepted trade is rejected
   with `STALE_TRADE_ACCEPT`.
4. **Stale accept** — accepting an offer that is already accepted, cancelled, or
   expired is rejected with `STALE_TRADE_ACCEPT` and no state change.
5. **Transactional** — the asset transfer (money/property) and the
   `TRADE_ACCEPTED` event commit atomically or not at all. A partial transfer is a
   fatal invariant breach.
6. **Fail-closed** — if the store or lock is unavailable, the accept is rejected
   and no mutation occurs.

### Events

Trade lifecycle mutations emit `TRADE_OFFERED`, `TRADE_ACCEPTED`,
`TRADE_CANCELLED`, and `TRADE_EXPIRED`. Replaying these events MUST rebuild an
identical board state and identical open-offer set.

### Golden vectors

Table-driven vectors in `backend/test/trade-accept.audit-spec.ts` cover:

- a valid accept transferring the exact assets and emitting `TRADE_ACCEPTED`;
- accept at/after `expiresAt` rejected with `TRADE_EXPIRED` and no state change;
- duplicate/concurrent accept of the same `(gameId, tradeId)` applied exactly once;
- accept of an already accepted/cancelled/expired offer rejected with
  `STALE_TRADE_ACCEPT`;
- non-recipient accept rejected with `NOT_TRADE_RECIPIENT`;
- client-supplied `expiresAt`/asset set ignored (server offer wins).

Vectors assert both the resulting asset state and the emitted event sequence.

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

## Prize pot accounting

The prize pot is the single escrowed balance for a game. It is mutated only by the
stake, join, cancel, and finish flows below; every mutation is transactional and
emits a game event so the pot can be rebuilt by replay.

### Invariants

Let `pot` be the escrowed balance, `stake` the per-player buy-in, and `players` the
set of joined players.

1. **Conservation** — `pot` equals the sum of all accepted stakes minus all
   refunds and the single winner payout. No other code path may credit or debit the
   pot.
2. **Stake** — a stake is accepted only once per player per game; the pot increases
   by exactly `stake`. Duplicate stakes are rejected with `ALREADY_STAKED` and no
   state change.
3. **Join** — joining requires an accepted stake; the pot is unchanged by join
   itself. Joining twice is idempotent by `playerId`.
4. **Cancel** — cancelling before the game starts refunds each joined player exactly
   their stake and zeroes the pot. Cancel after start is rejected with
   `GAME_ALREADY_STARTED` and no state change.
5. **Finish** — finishing pays the pot to the single winner and zeroes it. The pot
   must be non-negative at every step; a negative pot is a fatal invariant breach.
6. **Winner-only claim** — only the winner may claim; claims are idempotent by
   `gameId` and rejected with `NOT_WINNER` for non-winners and `ALREADY_CLAIMED`
   for duplicates.

### Events

Prize pot mutations emit `STAKE_ACCEPTED`, `PLAYER_JOINED`, `GAME_CANCELLED`,
`PRIZE_PAID`, and `POT_REFUNDED`. Replaying these events MUST rebuild an identical
pot balance.

### Golden vectors

Table-driven vectors in `backend/test/prize-pot.invariant-spec.ts` cover stake,
join, cancel, and finish, including duplicate stake, join-before-stake, cancel
after start, and finish with a zero pot. Vectors assert both the resulting pot and
the emitted event sequence.

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
