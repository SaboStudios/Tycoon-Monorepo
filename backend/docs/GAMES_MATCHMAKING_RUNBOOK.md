# Operational Runbook: Games & Matchmaking

## Overview
This runbook provides guidance for managing game lifecycles, troubleshooting matchmaking issues, and ensuring game state consistency.

## Realtime Transport (ADR-002)

Games are served over a WebSocket gateway on the `/games` namespace. The gateway is the
single source of truth for realtime turn flow; REST remains available for non-realtime reads.

### Handshake & Authentication (ADR-004)
-   Clients authenticate during the socket handshake with a JWT supplied via the auth cookie
    or the `Authorization: Bearer <token>` header. The gateway validates the token with the
    same secret/issuer as the REST API.
-   Unauthenticated or expired tokens are rejected at connect time with a `connect_error`
    carrying `{ code: 'UNAUTHORIZED', requestId }`. Clients must refresh the token and
    reconnect; the gateway never upgrades an anonymous socket.
-   If a JWT expires mid-game, the socket is disconnected on the next authenticated event.
    The client should refresh and rejoin the room (see Reconnect below).

### Rooms & Seat Authorization
-   Each game maps to a room keyed by `gameId`. On `join`, the gateway verifies the caller
    holds a seat in that game before adding the socket to the room.
-   `join` is idempotent: a duplicate join for the same `gameId`/`seat` is a no-op and returns
    the current room state rather than erroring or double-adding the socket.
-   Turn actions are authorized against the caller's seat. A `roll` from a socket that does not
    own the active turn is rejected with `{ code: 'NOT_YOUR_TURN', requestId }`.

### Server-Authoritative Dice
-   Dice outcomes are generated **only** on the server. Any client-supplied roll value in the
    payload is ignored and never trusted; the server result is what is broadcast to the room.
-   Roll events are rate-limited per socket/seat. Excess rolls are rejected with
    `{ code: 'RATE_LIMITED', requestId }` and counted in `tycoon_games_roll_rejected_total`.

### Payload Schema Version
-   Every gateway payload includes a `schemaVersion` field. Bump it on any breaking change and
    keep the gateway tolerant of the previous version during rollout.

### Redis Adapter (Horizontal Scale)
-   The gateway uses the Redis adapter so events fan out across all instances. Without it,
    multi-instance deploys drop events for sockets connected to other pods.
-   On a Redis partition, instances stop receiving cross-pod events. Sockets stay connected but
    may miss broadcasts; clients recover via reconnect + replay (below). Alert on adapter
    connection errors and treat sustained partitions as a degraded-realtime incident.

### Reconnect & Idempotency
-   Reconnect is coordinated with action idempotency keys: clients resend the last mutation with
    the same `X-Idempotency-Key`, and the server replays the stored result instead of re-rolling.
-   On reconnect the client rejoins its room; the gateway replays the current authoritative state
    so the client can reconcile any missed events.

## Game Code Lifecycle: PENDING → RUNNING (Stake Locks)

Matchmaking game codes move through an explicit, server-owned state machine. The server is the
only authority for transitions; clients can never set `status` directly.

### States
-   `PENDING` — a game code has been created by the host and is awaiting a joiner. The host's
    stake is **locked** at creation time.
-   `RUNNING` — the joiner has been admitted, both stakes are locked, and the game is live.
-   `CANCELLED` — the code expired or was cancelled before a joiner arrived; all locked stakes
    are released back to their owners.

### Create (host)
1.  Host calls `POST /games` with an `X-Idempotency-Key`. The server validates the JWT and
    confirms the caller is a seated participant.
2.  The server locks the host's stake and inserts the game with `status = 'PENDING'` in a single
    transaction. If the stake lock fails (insufficient balance, dependency outage), the whole
    operation fails closed and no game row is written.
3.  A duplicate create with the same idempotency key replays the stored result instead of
    creating a second game or double-locking the stake.

### Join (joiner)
1.  Joiner calls `POST /games/:code/join` with an `X-Idempotency-Key`. The server validates the
    JWT and confirms the caller is not already seated.
2.  The server locks the joiner's stake and transitions the game `PENDING → RUNNING` atomically.
    The transition is guarded by a conditional update (`WHERE status = 'PENDING'`); if the row is
    no longer `PENDING` the join is rejected with `{ code: 'GAME_NOT_PENDING', requestId }`.
3.  Concurrent duplicate joins are serialized by the conditional update plus the idempotency key:
    exactly one join wins, the rest replay the stored result or receive `GAME_NOT_PENDING`.

### Invariants
-   A game is `RUNNING` **only** when both stakes are locked. Never transition without a lock.
-   Stake locks are released on `CANCELLED` and on terminal game completion; never on a failed
    transition.
-   All transitions are fail-closed: if Postgres/Redis/shop-api is unavailable, the write is
    rejected rather than partially applied.

### Error Codes
-   `GAME_NOT_PENDING` — join attempted against a game that is not `PENDING`.
-   `STAKE_LOCK_FAILED` — stake could not be locked (insufficient funds or dependency outage).
-   `FORBIDDEN` — caller does not hold a seat / is not authorized for the transition.
-   `UNAUTHORIZED` — missing or expired JWT.
-   `RATE_LIMITED` — too many create/join attempts from the caller.

## Common Issues & Troubleshooting

### 1. Matchmaking Timeouts
If users are stuck in "PENDING" status and cannot find matches:
-   **Check Active Games Count**:
    ```sql
    SELECT count(*) FROM games WHERE status = 'PENDING';
    ```
-   **Redis Monitoring**: Check the matchmaking queues in Redis (if using a queue-based system).
-   **Log Analysis**: Look for "Matchmaking operation" in logs via `GamesObservabilityService`.

### 2. "Stuck" Games
If a game is in `RUNNING` status but no progress is being made (e.g., player disconnected):
1.  **Identify Next Player**:
    ```sql
    SELECT next_player_id FROM games WHERE id = <GAME_ID>;
    ```
2.  **Force Turn Skip (Emergency Only)**:
    Update the `next_player_id` to the next player in the turn order.
3.  **Terminate Game**: If the state is corrupted:
    ```sql
    UPDATE games SET status = 'CANCELLED' WHERE id = <GAME_ID>;
    ```
    Cancelling releases any locked stakes; verify balances before and after.

### 3. Idempotency Failures
If a user receives a `400 Bad Request` with "X-Idempotency-Key header is required":
-   The frontend must generate a unique UUID for every mutation (roll dice, buy property) and send it in the header.
-   If the user receives "A request with this idempotency key is already in progress", it means a previous request is still being processed. Advise the user to wait a few seconds.

## Operational Procedures

### Inspecting Game State in Redis
Games use Redis for real-time state and caching. To inspect a game's cache:
-   Command: `GET cache:game:<GAME_ID>`
-   Command: `KEYS *matchmaking*` (to see active matchmaking attempts)

### Handling AI Player Issues

AI opponent turns execute through the **same shared rule engine** as human turns. There is no AI-only rule path: dice, movement, rent, purchases, and turn advancement are computed server-side by the shared engine, and the AI only supplies a decision (e.g. roll / buy / pass) that is validated against the same invariants as a human action. This is the **AI vs human parity invariant** — any divergence is a bug, not a feature.

If AI players are not moving:
-   Check the `jobs` module to ensure the AI worker is running.
-   Check logs for `GamePlayersService.rollDice` for AI player IDs.
-   Confirm the AI turn was dispatched through the shared rule engine (look for the same `requestId`/correlation id used for human turns) rather than a divergent AI-only code path.
-   If the AI decision is rejected, the engine must fail closed: the turn is **not** advanced and the rejection is logged with the correlation id and an explicit error code (see `docs/API_ERROR_RESPONSE_STANDARDS.md`).

**Authz note:** AI turns are server-authoritative. Clients cannot trigger, spoof, or advance an AI turn; the WebSocket seat check and JWT authz apply to AI seats exactly as they do to human seats. A client attempting to act on an AI seat must be rejected (deny-by-default).

## Monitoring & Metrics
-   **Metric**: `tycoon_games_active_total` - Gauge of currently running games.
-   **Metric**: `tycoon_matchmaking_duration_seconds` - Histogram of time to match players.
-   **Metric**: `tycoon_games_pending_total` - Gauge of games awaiting a joiner.
-   **Metric**: `tycoon_games_transition_total` - Counter of `PENDING → RUNNING` transitions, labelled by outcome.
-   **Metric**: `tycoon_stake_lock_failures_total` - Counter of failed stake locks (fail-closed writes).
-   **Metric**: `tycoon_idempotency_hits_total` - Monitor how often replay protection is triggered.
-   **Metric**: `tycoon_ai_turn_duration_seconds` - Histogram of AI turn execution time through the shared rule engine.
-   **Metric**: `tycoon_ai_turn_rejections_total` - Counter of AI decisions rejected by the shared engine (parity/authz failures); alert on sustained non-zero rate.
-   **Metric**: `tycoon_games_roll_rejected_total` - Counter of rejected rolls (off-turn, rate-limited, or client-supplied outcomes).
-   **Metric**: `tycoon_games_ws_connections_total` - Gauge of active WebSocket connections on `/games`.

## Realtime Board State Synchronization

### WebSocket Gateway Overview

The Games module provides a WebSocket gateway (namespace: `games`) for real-time board state synchronization. This enables players to see turn changes, dice rolls, and other events instantly without polling.

**Event Set:**
- `join` — player joined a game session
- `roll` — player rolled dice (includes dice value)
- `turn` — turn advanced to a specific player
- `turn-ready` — player signaled ready for next turn
- `disconnect` — player left the session

### Handshake & Authentication

All WebSocket connections require JWT authentication:
1. **Token source:** Provide JWT via `handshake.auth.token` or `Authorization: Bearer <token>` header.
2. **Verification:** Server validates JWT signature on connection; invalid/missing tokens result in immediate disconnect.
3. **User context:** Authenticated user ID is attached to the socket for room isolation and per-player event handling.

### Room Isolation

- Each game session occupies a dedicated room: `game_<gameId>`.
- Only authenticated players in the room receive that game's events.
- No broadcast to unauthenticated clients.
- Disconnection automatically removes player from room and broadcasts `disconnect` event.

### CORS & Deployment

- Uses `getWsCorsConfig()` (same as `PerkBoostGateway`).
- Respects `WS_CORS_ORIGINS` environment variable; wildcard (`*`) rejected in production.
- Recommended: Set `WS_CORS_ORIGINS=https://app.example.com` in production.

### Connection Limits & Monitoring

- **Metric:** `socket.io.connected_clients` (track socket.io connection pool)
- **Alert:** Monitor for unusual spikes in connection count (possible bot activity or stuck connections).
- **Timeout:** Idle connections are reaped by socket.io's built-in heartbeat (default ~60s).

### Frontend Integration (Out of Scope)

Frontend clients must:
1. Establish WebSocket connection to `/socket.io/` with JWT token.
2. Emit `join` event with `{ gameId: <number> }` after connection.
3. Listen for `roll`, `turn`, `disconnect` events and update board state accordingly.

**Note:** Frontend integration is a follow-up to this ADR; backend gateway is production-ready and awaits client implementation.

---

## Support Contacts
-   Game Logic Team: #team-game-engine
-   Infrastructure: #team-infra
