# Operational Runbook: Games & Matchmaking

## Overview
This runbook provides guidance for managing game lifecycles, troubleshooting matchmaking issues, and ensuring game state consistency.

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
If AI players are not moving:
-   Check the `jobs` module to ensure the AI worker is running.
-   Check logs for `GamePlayersService.rollDice` for AI player IDs.

## Monitoring & Metrics
-   **Metric**: `tycoon_games_active_total` - Gauge of currently running games.
-   **Metric**: `tycoon_matchmaking_duration_seconds` - Histogram of time to match players.
-   **Metric**: `tycoon_idempotency_hits_total` - Monitor how often replay protection is triggered.

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
