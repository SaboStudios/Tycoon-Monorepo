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
  tokens are rejected before the socket is accepted; the client receives an
  `unauthorized` error and the socket is closed.
- The verified principal (`sub`, `seat`, `gameId` when present) is attached to
  `socket.data` and is the only source of identity for later events.

### 2. Rooms and seat authorization

- Each game uses a room keyed by `gameId` (room name `game_<gameId>`).
- `join` accepts `{ gameId, seat }`. The gateway verifies that the authenticated
  principal is allowed to occupy that seat for that game before adding the
  socket to the room.
- `join` is idempotent: a duplicate join for the same `gameId`/`seat` is a no-op
  and returns the current room state instead of erroring or double-adding.
- Turn and roll events are only accepted from the socket that currently holds
  the active seat. Off-turn actions are rejected with a `forbidden` error and
  are not broadcast.
- Only authenticated players in that game's room receive updates; there is no
  broadcast to unauthenticated clients.

### 3. Server-authoritative dice

- Clients never send dice outcomes. Any `roll` payload containing a result,
  value, or seed field is rejected.
- The server generates the dice result, records it against the game, and
  broadcasts the authoritative result to the room.
- This keeps the server as the single source of truth and prevents turn and
  dice spoofing.

### 4. Redis adapter, rate limiting, schema version

- The gateway uses the Socket.IO Redis adapter so events fan out across all
  gateway instances. A Redis partition degrades to per-instance delivery; the
gateway logs the failure and clients fall back to REST polling until the
  adapter reconnects.
- `roll` events are rate limited per socket and per game to bound abuse.
- Every payload includes a `schemaVersion` field so clients can negotiate
  compatible event shapes as the protocol evolves.

### 5. Reconnect and idempotency

- Reconnect reuses the existing JWT; if the token expired mid-game the client
  must refresh and re-handshake.
- Action idempotency keys are coordinated with the REST write path so a
  reconnect replay does not double-apply a turn or roll.
- On reconnect the client rejoins its room and receives the current state
  rather than a replay of missed events.

### 6. Graceful unsubscribe on ban / admin force-end

When a user is banned or an admin force-ends a game/session, the gateway must
detach the affected socket(s) from the game room **without leaking state** and
without relying on the client to disconnect voluntarily.

**Triggers:**
- `user.banned` — emitted by the admin/moderation path when a principal is banned.
- `game.force_end` — emitted by an admin force-end action for a specific `gameId`.

**Behavior:**
1. The gateway resolves the affected sockets by `userId` (ban) or by room
   membership `game_<gameId>` (force-end).
2. For each affected socket it emits a terminal `unsubscribed` event carrying a
   stable reason code (`banned` or `force_end`) and the `gameId`, then calls
   `socket.leave('game_<gameId>')` so the socket no longer receives room events.
3. The socket is then disconnected (`socket.disconnect(true)`). No further room
   events are delivered after the `unsubscribed` event.
4. The room is torn down once empty; no residual per-game state (turn timers,
   rate-limit buckets, seat reservations) is retained for the ended game.
5. The unsubscribe path is idempotent: a repeated ban/force-end for the same
   socket or game is a no-op and does not emit duplicate terminal events.

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
- **Deny-by-default.** Chat is off unless the `GAMES_CHAT_ENABLED` f

/* … truncated 2749 chars — edit only what you need near the top … */
