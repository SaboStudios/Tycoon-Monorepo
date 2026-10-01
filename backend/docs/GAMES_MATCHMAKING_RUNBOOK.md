# Games Matchmaking Runbook

Operational guide for the Tycoon games matchmaking and realtime (WebSocket) layer.
Covers the `GamesGateway` (ADR-002), Redis adapter fan-out, the graceful
unsubscribe path used when a user is banned or an admin force-ends a game/session,
and the **disconnect forfeit timers presence policy**.

## Scope

- Matchmaking queue lifecycle (join, match, seat assignment).
- Realtime gateway handshake, authorization, and room membership.
- Graceful WS unsubscribe on **user ban** and **admin force-end**.
- **Disconnect forfeit timers and presence policy** (see below).
- Multi-instance delivery via the Redis adapter.

## Architecture references

- ADR-002 — Realtime gateway: JWT handshake, seat vs spectator authz, server-authoritative outcomes.
- ADR-003 — NEAR wallet is the only supported chain UI until Stellar is gated ready.
- `backend/docs/GRACEFUL_SHUTDOWN.md` — process shutdown semantics.
- `ADMIN_ROUTES_MATRIX.md` — admin route authorization matrix.

## Gateway handshake (ADR-002)

- JWT is accepted from **either** the `access_token` cookie, the
  `Authorization: Bearer <token>` header, **or** the `auth.token` handshake
  auth field (native clients), in that precedence order — matching REST parity
  (ADR-004). The gateway must not accept a token from any other source.
- The token is verified during the handshake. Missing, malformed, or
  expired-beyond-clock-tolerance tokens are rejected with `AUTH_REQUIRED`: the
  gateway emits `game:error` and then disconnects the socket.
- On handshake, the socket is authorized as **seat** or **spectator**:
  - Seat: the authenticated user holds a seat in the target game (verified
    against `game_players` when the socket joins).
  - Spectator: authenticated but not seated; read-only (join with
    `asSpectator: true`).
- Suspended accounts and principals carrying a ban/termination signal are
  rejected at (re)connect with `USER_BANNED` until the ban is lifted.
- Deny-by-default: unauthenticated sockets are rejected before any room join.
- Illegal actions are rejected with **stable error codes** (see below); the socket
  is not silently dropped for a single illegal action unless it is a ban/force-end.

### Stable error codes

| Code | Meaning |
| --- | --- |
| `AUTH_REQUIRED` | No/invalid JWT on handshake or action. |
| `AUTH_EXPIRED` | Token expired mid-session. |
| `FORBIDDEN_ROLE` | Spectator attempted a seat-only action (e.g. roll). |
| `NOT_SEATED` | Action requires a seat the user does not hold (or the socket never joined this game). |
| `NOT_YOUR_TURN` | Turn/seat already acted, or it is another seat's turn. |
| `GAME_NOT_FOUND` | Target game/session does not exist. |
| `GAME_ENDED` | Game/session already force-ended or completed. |
| `USER_BANNED` | User was banned/suspended; socket detached. |
| `RATE_LIMITED` | Join/action exceeded the rate limit. |
| `DUPLICATE_ACTION` | Idempotency key already processed (or reused with a different intent / in flight). |
| `INVALID_PAYLOAD` | Malformed payload or a client-supplied outcome (never trusted). |
| `DEPENDENCY_UNAVAILABLE` | Redis/Postgres outage; write failed closed and was not applied. |
| `CHAT_DISABLED` | In-game chat disabled pending the moderation pipeline (ADR-002 §7). |
| `INTERNAL_ERROR` | Unexpected server error; correlate via `requestId`. |

### Protocol events (`schemaVersion: 1`)

Client → server: `game:join { gameId, asSpectator? }`,
`game:roll { gameId, idempotencyKey }`, `game:end-turn { gameId, idempotencyKey }`,
`game:leave { gameId? }`, `chat:send { gameId, text }`.

Server → client: `game:snapshot` (full state for the calling socket; carries
`replayed`/`action`/`dice` after roll/end-turn), `game:state` (room broadcast
after a server-authoritative action), `game:error { schemaVersion, code,
message, requestId? }`, `game:unsubscribed { reason, code?, terminal, gameId }`,
`chat:message` (only when `GAMES_CHAT_ENABLED=true`).

Room name: `game_<gameId>`.

## Server-authoritative outcomes

- Clients submit **intents** only (join, roll, leave). The server computes and
  broadcasts outcomes; clients never submit results.
- Every mutating intent carries an **idempotency key**. Duplicate or reconnect
  retries with the same key return the prior result and do not re-apply effects.
- Money, dice, inventory, and admin mutations remain server-side source of truth.

## Disconnect forfeit timers and presence policy

A seated player who disconnects must not stall the game indefinitely, and a
spectator disconnecting must never affect play. Presence is tracked per
**user + game**, not per socket, so duplicate tabs and reconnects do not
incorrectly start or cancel a forfeit timer.

### Presence model

- Presence is keyed by `(gameId, userId)` with a reference count of live sockets.
- A user is **present** while at least one authorized socket for that game is
  connected; the user is **absent** only when the last socket detaches.
- Spectators are tracked for room membership only and are **excluded** from
  forfeit timers entirely.
- Presence transitions are server-authoritative; clients cannot assert presence.

### Forfeit timer rules

1. When a **seated** user transitions present → absent, start (or resume) a
   forfeit timer for that seat. The timer duration is server-configured; clients
   are told the deadline, never the policy internals.
2. When the same seated user reconnects (present again) **before** the deadline,
   cancel the timer and resume play from the snapshot/replay path. No forfeit is
   applied.
3. If the deadline elapses with the user still absent, the server applies the
   forfeit outcome (server-authoritative) and emits the terminal event to the
   room. Clients never compute or submit the forfeit result.
4. A spectator disconnect never starts a timer and never ends the game.
5. If **all** seated users are absent, the game is paused and the timer policy
   applies per seat; the game is not force-ended solely due to absence unless the
   configured policy says so.

### Duplicate tabs and reconnects

- A second tab for the same user+game increments the presence refcount; it does
  **not** start a second timer and does **not** grant a second seat.
- Closing one of several tabs does not mark the user absent; the timer only
  starts when the refcount reaches zero.
- Reconnect retries are idempotent: repeated handshakes for the same user+game
  converge to a single presence entry and a single timer.

### Multi-instance presence (Redis adapter)

- Presence refcounts and forfeit deadlines live in Redis so every instance sees
  the same state; a disconnect on one instance is observed by all.
- Timer expiry is driven by a single authoritative scheduler (or a Redis-keyed
  deadline with a compare-and-set claim) so only one instance applies the
  forfeit. Duplicate expiry attempts are no-ops.
- **Redis pub/sub lag:** presence updates are eventually consistent across
  instances. A lagging instance must not start a duplicate timer; it reconciles
  against the Redis deadline before acting.
- **Sticky sessions:** if any deployment still relies on sticky sessions for
  handshake affinity, document it here and prefer the Redis adapter for
  correctness. Sticky sessions are an optimization, not a correctness requirement.

### Failure modes for presence

- **Redis outage:** fail closed — do not start or cancel forfeit timers on
  unverified presence; surface the outage and hold the game rather than
  forfeiting a possibly-present player.
- **Auth expiry mid-session:** treat as a disconnect for presence purposes; the
  user may reconnect with a fresh handshake before the deadline.
- **Event reordering after reconnect:** presence transitions carry monotonic
  sequence/version so a stale "absent" cannot cancel a newer "present".

## Graceful WS unsubscribe on ban / admin force-end

When a user is banned or an admin force-ends a game/session, the gateway must
**detach the socket from the game room without leaking state** and without
abruptly killing unrelated sockets.

### Trigger paths

1. **User ban** — admin ban action (see `ADMIN_ROUTES_MATRIX.md`) emits a ban event.
2. **Admin force-end** — admin force-end action emits a game-ended event.

### Required behavior

1. Resolve all sockets belonging to the affected user (ban) or all sockets in the
   affected game room (force-end).
2. Emit a terminal event to each affected socket with the stable code
   (`USER_BANNED` or `GAME_ENDED`) **before** detaching, so clients can render a
   correct player-facing state.
3. `leave` the socket from the game room and clear per-socket game state
   (seat, spectator flag, pending idempotency keys for that game).
4. Do **not** broadcast hidden state (hidden cards, private hands) to spectators
   or to the detached socket during teardown.
5. For force-end, mark the game/session ended so late joiners receive `GAME_ENDED`
   rather than a stale snapshot.
6. For ban, reject any subsequent handshake or action from that user with
   `USER_BANNED` until the ban is lifted.

### Idempotency and ordering

- Ban/force-end teardown is idempotent: repeated events for the same user/game are
  no-ops after the first.
- Teardown must be ordered after any in-flight action for that socket is resolved
  or rejected, so clients do not observe an outcome after a terminal event.
- Reconnect after a ban/force-end must fail closed with the terminal code; it must
  not restore playability.

## Multi-instance delivery (Redis adapter)

- The gateway uses the Redis adapter so room broadcasts and ban/force-end
  teardown reach sockets on every instance.
- Ban/force-end events are published on the Redis channel and each instance
  detaches its local sockets for the affected user/game.
- **Sticky sessions:** if any deployment still relies on sticky sessions for
  handshake affinity, document it here and prefer the Redis adapter for
  correctness. Sticky sessions are an optimization, not a correctness requirement.
- **Redis pub/sub lag:** teardown is eventually consistent across instances. The
  terminal event is authoritative; a lagging instance must still reject further
  actions for the affected user/game once it observes the ban/force-end.

## Rate limiting and metrics

- Rate limits (fixed 60s windows, Redis-coordinated per user and per socket):
  - `game:join` — 10 / socket, 30 / user (own bucket).
  - `game:roll`, `game:end-turn`, `chat:send` — 30 / socket, 90 / user
    (shared action bucket).
- Exceeding a limit rejects with `RATE_LIMITED`. When Redis is unreachable the
  limiter degrades to per-instance in-memory windows (cross-instance precision
  resumes when Redis recovers) instead of failing open silently.
- Metrics (Prometheus, no PII, no tokens in labels):
  - `tycoon_games_ws_connected_sockets` (gauge)
  - `tycoon_games_ws_rejected_actions_total{code}` (counter, stable code label)
  - `tycoon_games_ws_teardowns_total{reason}` (counter: `banned` / `force_end`)
  - `tycoon_games_ws_adapter_publish_failures_total` (counter)
  - `tycoon_games_ws_rate_limited_total{action}` (counter)
  - active forfeit timers (gauge) / forfeits applied (counter) — presence policy

## Failure modes

- **Postgres/Redis/shop-api/RPC outage:** fail closed on writes; do not accept
  intents that cannot be authoritatively applied. Idempotent roll/end-turn over
  an unavailable Redis store rejects with `DEPENDENCY_UNAVAILABLE` and the
  action is **not** applied.
- **Auth expiry mid-session:** reject with `AUTH_EXPIRED`; require re-handshake.
- **Duplicate tab joins:** dedupe by user+game; a second tab joins as spectator or
  is rejected per seat policy, never as a second seat.
- **Event reordering after reconnect:** clients resume from a snapshot or replay
  events; idempotency keys make replays safe.
- **Adversarial input:** reject oversized payloads and spoofed events; never trust
  client-supplied game ids, seats, or outcomes.

## Rollback notes

- Ban/force-end teardown is additive; disabling the feature flag reverts to the
  prior behavior without schema changes.
- Forfeit timers are additive and server-driven; disabling the presence policy
  flag reverts to no-forfeit behavior without schema changes.
- If Redis adapter issues arise, fall back to single-instance delivery and record
  the limitation here until resolved.

## Test plan

- Unit: authz matrix seat vs spectator; stable error code mapping
  (`games.gateway.spec.ts`, seat-ownership guard spec).
- Unit: presence refcount and forfeit timer start/cancel on present↔absent.
- E2E: handshake rejections, spectator authz, authoritative roll/turn cycle,
  chat deny-by-default, leave, reconnect state restore, ban teardown, join rate
  limit — `test/games-ws.e2e-spec.ts` (sqlite harness in
  `test/utils/games-ws-harness.ts`).
- E2E: idempotent replay does not double-apply, Redis outage fails closed with
  `DEPENDENCY_UNAVAILABLE`, reused/in-flight keys reject with
  `DUPLICATE_ACTION` — `test/game-idempotency.e2e-spec.ts`.
- E2E: disconnect starts forfeit timer; reconnect before deadline cancels it;
  deadline elapse applies server-authoritative forfeit.
- E2E: ban and admin force-end detach sockets and reject reconnect.
- Optional: load smoke for connected sockets and Redis adapter fan-out.
