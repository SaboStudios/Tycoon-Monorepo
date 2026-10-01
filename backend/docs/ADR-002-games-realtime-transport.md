# ADR-002: Games Realtime Transport — WebSocket vs Server-Sent Events

- Status: Accepted
- Date: 2024-01-01
- Deciders: Platform, Games
- Author: Backend Team
- Related: ADR-004 (auth), ADR-001 (shop purchase write path), `GAMES_MATCHMAKING_RUNBOOK.md`
- Issue: #1440

## Context

The games surface is currently REST-only. Clients poll for match state, which
adds latency, wastes bandwidth, and makes turn-based play feel sluggish. We need
a realtime transport that:

- authenticates players using the same JWT issued by the auth service (ADR-004),
- keeps turn state authoritative on the server so clients cannot spoof dice or
  turns,
- fans out events across multiple gateway instances for horizontal scale,
- survives reconnects without replaying or duplicating actions.

Two primary transports are candidates:

1. **WebSocket** — bidirectional, full-duplex, stateful per client
2. **Server-Sent Events (SSE)** — unidirectional (server→client), HTTP-based, simpler

**Constraints:**
- Must support JWT-authenticated handshakes (no unauthenticated broadcast)
- Must handle turn-based game actions (player rolls, buys property)
- Must scale horizontally (prefer stateless when possible)
- Minimal event set: `join`, `roll`, `turn`, `disconnect`

## Decision

We will expose a WebSocket gateway on the `/games` namespace using Socket.IO.
The gateway is the single realtime entry point for matchmaking, turns, and dice.

### Rationale

| Criterion | WebSocket | SSE |
|-----------|-----------|-----|
| **Bidirectional** | ✅ (native) | ❌ (requires separate HTTP for client→server) |
| **Game Actions** | ✅ (send roll, buy property) | ⚠️ (requires parallel POST requests) |
| **Latency** | ✅ (low) | ✅ (adequate for turn-based) |
| **Scalability** | ⚠️ (stateful, needs sticky sessions or Redis) | ✅ (stateless) |
| **Auth** | ✅ (handshake-based JWT) | ✅ (via Authorization header) |
| **Complexity** | ⚠️ (socket.io protocol) | ✅ (simple HTTP chunks) |
| **Industry Standard** | ✅ (games use WebSocket) | ❌ (not standard for games) |

**WebSocket chosen because:**
1. **Bidirectional communication** is essential for turn-based game actions (rolling dice, making moves) — clients must send actions in real time, not just receive updates.
2. **Turn-based gameplay** doesn't require extreme low-latency (unlike action games), so the slightly higher complexity of WebSocket is worth the cleaner UX.
3. **Industry norm** — multiplayer games universally use WebSocket or proprietary protocols; SSE is primarily for notifications (Slack, GitHub, HackerNews tickers).
4. **Architectural fit** — this codebase already uses socket.io (`PerkBoostGateway`), so leveraging existing patterns reduces learning curve and infrastructure overhead.

### 1. Namespace and handshake

- Namespace: `/games`.
- JWT is read from the `access_token` cookie first, then from the
  `Authorization: Bearer <token>` header, then from the `auth.token` handshake
  field. This mirrors ADR-004 so browser and native clients share one path.
- The token is verified during the handshake. Missing, malformed, or expired
  (beyond clock tolerance) tokens are rejected before the socket is accepted:
  the gateway emits `game:error { schemaVersion, code: AUTH_REQUIRED, ... }`
  and then disconnects the socket. Suspended accounts and principals carrying a
  ban/termination signal are rejected with `USER_BANNED` on every (re)connect.
- The verified principal (`sub`, role, admin flag, token `exp`) is attached to
  `socket.data` and is the only source of identity for later events;
  client-supplied userIds are never trusted. Token expiry is re-checked on
  every action (`AUTH_EXPIRED`).

### 2. Rooms and seat authorization

- Each game uses a room keyed by `gameId` (room name `game_<gameId>`).
- `join` accepts `{ gameId, asSpectator? }`. The gateway derives the seat from
  `game_players` for the verified principal — clients never supply a seat id.
  A seated user joins as `player`; a seatless user must opt in with
  `asSpectator: true` or the join is rejected with `NOT_SEATED`.
- `join` is idempotent: a duplicate join for the same `gameId` re-emits the
  current `game:snapshot` instead of erroring or double-adding.
- Turn and roll events are only accepted from the seat that currently holds
  `next_player_id` (otherwise `NOT_YOUR_TURN`) and only from sockets joined as
  `player` (spectators get `FORBIDDEN_ROLE`, unjoined sockets get
  `NOT_SEATED`). Illegal actions are rejected with stable codes and are not
  broadcast.
- Only sockets in that game's room receive room events; there is no
  broadcast to unauthenticated clients.

### 3. Server-authoritative dice

- Clients never send dice outcomes. Any `roll` payload containing a result,
  value, or seed field (`dice1`, `dice2`, `d1`, `d2`, `dice`, `result`,
  `value`, `seed`, `outcome`) is rejected with `INVALID_PAYLOAD` before any
  validation or rate-limit consumption.
- The server generates the dice with `crypto.randomInt`, records the movement
  against the game, and broadcasts the authoritative result (`game:state` with
  the dice and public state) to the room plus a `game:snapshot` to the actor.
- This keeps the server as the single source of truth and prevents turn and
  dice spoofing.

### 4. Redis adapter, rate limiting, schema version

- The gateway uses the Socket.IO Redis adapter so events fan out across all
  gateway instances. A Redis partition degrades to per-instance delivery; the
  gateway logs the failure, records `tycoon_games_ws_adapter_publish_failures_total`,
  and clients fall back to REST polling until the adapter reconnects.
- Fixed-window rate limits per 60s, coordinated in Redis: `join` is capped at
  10/socket and 30/user; `roll`/`end-turn`/`chat` share 30/socket and 90/user.
  Exceeding a limit rejects with `RATE_LIMITED`. A Redis outage degrades to
  per-instance windows rather than failing open.
- Every payload includes a `schemaVersion` field (currently `1`) so clients
  can negotiate compatible event shapes as the protocol evolves.

### 5. Reconnect and idempotency

- Reconnect reuses the existing JWT; if the token expired mid-game the client
  must refresh and re-handshake (`AUTH_EXPIRED` on the stale session).
- Every mutating intent (`game:roll`, `game:end-turn`) carries an
  `idempotencyKey` (8–200 chars). The key is coordinated with the REST write
  path through the shared store key/canonical hash:
  - same key + same intent → the prior result is returned, nothing is
    re-applied, and only the acting socket receives a `game:snapshot` with
    `replayed: true` (no second `game:state` broadcast);
  - same key + different intent → `DUPLICATE_ACTION` (fail closed);
  - key already claimed in flight (concurrent tab/retry) → `DUPLICATE_ACTION`;
  - Redis unavailable → `DEPENDENCY_UNAVAILABLE` and the action is **not**
    applied (fail closed on writes).
- On reconnect the client rejoins its room and receives the current state
  (`game:snapshot`) rather than a replay of missed events; reconnect restores
  playability without double-applying anything.

### 6. Graceful unsubscribe on ban / admin force-end

When a user is banned or an admin force-ends a game/session, the gateway must
detach the affected socket(s) from the game room **without leaking state** and
without relying on the client to disconnect voluntarily.

**Triggers:**
- `user.banned` — emitted by the admin/moderation path when a principal is banned.
- `game.force_end` — emitted by an admin force-end action for a specific `gameId`.

**Behavior:**
1. The gateway resolves the affected sockets by `userId` (ban) or by room
   membership `game_<gameId>` (force-end) through `GamesRealtimeBridge`.
2. For each affected socket it emits a terminal `game:unsubscribed` event
   carrying `{ reason: 'banned' | 'force_end', code: USER_BANNED | GAME_ENDED,
   terminal: true, gameId }`, then calls
   `socket.leave('game_<gameId>')` so the socket no longer receives room events.
3. The socket is then disconnected (`socket.disconnect(true)`). No further room
   events are delivered after the `game:unsubscribed` event.
4. The room is torn down once empty; no residual per-game state (turn timers,
   rate-limit buckets, seat reservations) is retained for the ended game.
5. The unsubscribe path is idempotent: a repeated ban/force-end for the same
   socket or game is a no-op and does not emit duplicate terminal events.
6. Every subsequent handshake or action from a banned principal fails closed
   with `USER_BANNED` (and force-ended games with `GAME_ENDED`) until the ban
   is lifted / the game is restored.

**Multi-instance delivery:** the ban/force-end signal is published through the
Redis adapter so every gateway instance detaches its local sockets for that
user/game. If the Redis adapter is unavailable, the gateway fails closed for
new joins to the affected game and logs the degraded state; local sockets are
still detached on the instance that received the signal.

**Authz:** only the admin/moderation path (AdminGuard / API-key) may publish
ban or force-end signals. Clients cannot self-unsubscribe another player, and
no unauthenticated broadcast is performed.

**Error mapping:** terminal events use stable codes per
`docs/API_ERROR_RESPONSE_STANDARDS.md` (`banned`, `force_end`) with
`requestId`/correlation for observability.

### 7. In-game chat moderation (or explicit disable)

In-game chat is a user-facing, abuse-prone surface. Until a moderation pipeline
is wired end-to-end, chat is **explicitly disabled** on the `/games` namespace
rather than shipped unmoderated. This section is the source of truth for the
chat abuse controls referenced by issue #1786.

**Invariants (chat abuse controls):**
- **Server authority.** The gateway is the only component that accepts, filters,
  and fans out chat. Clients never broadcast directly to a room; a `chat:send`
  event is validated server-side before any fanout.
- **Deny-by-default.** Chat is off unless the `GAMES_CHAT_ENABLED` flag is set;
  while off, `chat:send` rejects with the stable code `CHAT_DISABLED` and
  nothing is broadcast. When enabled, messages fan out as `chat:message` only
  to sockets in the game room.

### 8. Server-only chance/community RNG auditability

Chance and Community Chest tiles resolve economic outcomes (money transfers,
`Get Out of Jail Free` grants, property repairs, player-to-player payments).
These outcomes are **server-only** and must be auditable and replayable. This
section is the source of truth for issue #1772.

**Invariants:**
- **Server-only resolution.** The server is the only component that draws a
  Chance/Community card and applies its effect. Clients never send a card id,
  deck index, or outcome; any `chance`/`community` action payload containing a
  card, index, or effect field is rejected with a `forbidden` error and is not
  broadcast.
- **Pure rules module.** Card definitions and effect rules from
  `docs/BOARD_TILE_MODEL.md` are encoded in a pure, side-effect-free server
  module (no I/O, no clock, no RNG globals). The module takes the deck state and
  an injected RNG and returns the drawn card plus the resulting effect
  descriptor. HTTP and WS actions consume this module; they do not re-implement
  rules.
- **Ruleset pinning.** Each game row pins a `rulesetVersion` and a
  `rulesetHash` (hash of the encoded card/effect rules) at creation. Draws are
  resolved against the pinned ruleset, never against client-supplied constants
  or the current head of the module. A game whose pinned hash no longer matches
  a known ruleset fails closed on the next draw rather than silently changing
  behavior.
- **Transactional apply.** Money and property mutations from a card effect are
  applied in a single transaction with the draw record. Either the draw and its
  effect commit together or neither does; a partial apply is never persisted.
- **Event emission for replay.** Each resolved draw emits a game event
  (`chance.drawn` / `community.drawn`) carrying the pinned `rulesetVersion`,
  `rulesetHash`, the drawn card id, the effect descriptor, and the resulting
  state delta. Replaying the event stream against the pinned ruleset must
  rebuild identical game state.
- **Idempotency.** Draws are keyed by an idempotency key coordinated with the
  REST write path so a reconnect replay or concurrent duplicate request does not
  draw twice or double-apply an effect.
- **Fail-closed on dependency outage.** If Postgres, Redis, or the shop-api is
  unavailable, the draw write fails closed; no card is drawn and no effect is
  applied until the dependency recovers.
- **Frontend renders server results only.** The client displays the server's
  quoted draw and effect; it performs no local finalization of economic
  outcomes.

**Test plan:** table-driven golden vectors for the Chance/Community rule family
(deck composition, draw order, each effect's money/property delta), concurrency
vectors for duplicate draws, and a replay-equality check that rebuilding from
emitted events matches the live state.

**Acceptance criteria:** rule vectors pass; the client cannot override economic
outcomes; the ruleset is pinned per game; docs match code.
