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

### Minimal Event Set

**Server → Client:**
- `join` — player joined a game session
- `turn` — turn changed to a specific player
- `roll` — player rolled dice (dice value + player info)
- `disconnect` — player left the session

**Client → Server:**
- `join` — player joins a specific game room
- `roll` — player initiates a dice roll
- `turn-ready` — player signals ready for next turn

### CORS & Origin Restrictions

- Uses `getWsCorsConfig()` (same as `PerkBoostGateway`).
- No `*` wildcard allowed (enforced at startup for production).
- Respects `WS_CORS_ORIGINS` environment variable.

## Consequences

- Realtime play no longer requires polling.
- Turn and dice integrity is enforced server-side.
- Multi-instance deployments scale through the Redis adapter.
- Clients must handle handshake rejection, off-turn errors, and reconnect.

### AI Opponent Turns — Shared Rule Engine Parity (Issue #1703)

AI opponent turns MUST execute through the **same shared rule engine** as human turns. There is no AI-only rule path.

**Parity invariants:**
1. **Single rule engine** — both human and AI turns are resolved by the shared rule engine (dice, movement, rent, purchases, bankruptcy). AI never mutates board state directly.
2. **Server authority** — the server is the sole source of truth for dice, money, inventory, and turn mutations. AI decisions are computed server-side only; clients cannot submit, spoof, or replay AI actions.
3. **Same event surface** — AI turns emit the same `turn` / `roll` events as human turns, so clients render AI and human turns identically.
4. **Deterministic inputs** — AI decisions are derived from the same server-side game state snapshot the rule engine consumes for human turns; no privileged state access.
5. **Idempotency** — AI turn advancement is keyed by `(gameId, turnIndex)` so duplicate/reconnect retries cannot double-apply a turn.

**Authz:** AI turns are triggered only by server-side scheduling or an authenticated, authorized caller (JWT / AdminGuard / API-key / WS seat check). Untrusted clients cannot trigger or spoof AI turns; deny-by-default for any new AI-turn entrypoint.

**Error mapping:** AI-turn failures surface typed errors with explicit codes per `docs/API_ERROR_RESPONSE_STANDARDS.md`, including `requestId`/correlation for observability. Writes fail closed on dependency outage (Postgres/Redis/RPC).

**Rollout:** AI-turn execution is gated behind a feature flag/kill switch; rollback disables AI turns without affecting human turn handling.

---

## Explicit Out of Scope

- **Frontend client implementation** (`useGameBoardLogic` wiring) — this ADR defines the backend gateway only; frontend updates are a follow-up.
- **Game action processing logic** (rolling, buying properties) — existing REST endpoints continue to handle this; WebSocket is for state sync only.
- **Persistence** — WebSocket events are ephemeral notifications; permanent state lives in the database.
- Unrelated package refactors.
- Mainnet irreversible deploys without a readiness issue.

## Testing & Rollout

1. **Unit tests** — gateway connection, disconnection, message routing.
2. **Integration tests** — full handshake flow, unauthorized rejection, room isolation.
3. **Canary deployment** — enable gateway for 10% of users, monitor connection health and error rates.
4. **Gradual rollout** — increase percentage as confidence grows; monitor socket.io connection pool usage.

## Related ADRs

- ADR-001: Shop Purchase Write Path — established proxy pattern; not directly related but shows decision-making approach.
- ADR-004: Auth — JWT issuance and verification used by the handshake.

