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

## Support Contacts
-   Game Logic Team: #team-game-engine
-   Infrastructure: #team-infra
