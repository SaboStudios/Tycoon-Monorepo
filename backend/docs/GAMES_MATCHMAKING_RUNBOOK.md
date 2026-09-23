# Games Matchmaking Runbook

Operational guide for the Tycoon games matchmaking and realtime (WebSocket) layer.
Covers the `GamesGateway` (ADR-002), Redis adapter fan-out, and the graceful
unsubscribe path used when a user is banned or an admin force-ends a game/session.

## Scope

- Matchmaking queue lifecycle (join, match, seat assignment).
- Realtime gateway handshake, authorization, and room membership.
- Graceful WS unsubscribe on **user ban** and **admin force-end**.
- Multi-instance delivery via the Redis adapter.

## Architecture references

- ADR-002 — Realtime gateway: JWT handshake, seat vs spectator authz, server-authoritative outcomes.
- ADR-003 — NEAR wallet is the only supported chain UI until Stellar is gated ready.
- `backend/docs/GRACEFUL_SHUTDOWN.md` — process shutdown semantics.
- `ADMIN_ROUTES_MATRIX.md` — admin route authorization matrix.

## Gateway handshake (ADR-002)

- JWT is accepted from **either** the `Authorization: Bearer <token>` header **or** the
  auth cookie, with header/query parity with REST. The gateway must not accept a
  token from any other source.
- On handshake, the socket is authorized as **seat** or **spectator**:
  - Seat: the authenticated user holds a seat in the target game.
  - Spectator: authenticated but not seated; read-only.
- Deny-by-default: unauthenticated sockets are rejected before any room join.
- Illegal actions are rejected with **stable error codes** (see below); the socket
  is not silently dropped for a single illegal action unless it is a ban/force-end.

### Stable error codes

| Code | Meaning |
| --- | --- |
| `AUTH_REQUIRED` | No/invalid JWT on handshake or action. |
| `AUTH_EXPIRED` | Token expired mid-session. |
| `FORBIDDEN_ROLE` | Spectator attempted a seat-only action (e.g. roll). |
| `NOT_SEATED` | Action requires a seat the user does not hold. |
| `GAME_NOT_FOUND` | Target game/session does not exist. |
| `GAME_ENDED` | Game/session already force-ended or completed. |
| `USER_BANNED` | User was banned; socket detached. |
| `RATE_LIMITED` | Join/roll exceeded the rate limit. |
| `DUPLICATE_ACTION` | Idempotency key already processed. |

## Server-authoritative outcomes

- Clients submit **intents** only (join, roll, leave). The server computes and
  broadcasts outcomes; clients never submit results.
- Every mutating intent carries an **idempotency key**. Duplicate or reconnect
  retries with the same key return the prior result and do not re-apply effects.
- Money, dice, inventory, and admin mutations remain server-side source of truth.

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

- Rate-limit `join` and `roll` per user and per socket; reject with `RATE_LIMITED`.
- Metrics to emit (no PII, no tokens in labels):
  - connected sockets (gauge)
  - rejected actions by stable error code (counter)
  - ban/force-end teardowns (counter)
  - Redis adapter publish failures (counter)

## Failure modes

- **Postgres/Redis/shop-api/RPC outage:** fail closed on writes; do not accept
  intents that cannot be authoritatively applied.
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
- If Redis adapter issues arise, fall back to single-instance delivery and record
  the limitation here until resolved.

## Test plan

- Unit: authz matrix seat vs spectator; stable error code mapping.
- E2E: join / roll / reconnect; `game-idempotency.e2e`.
- E2E: ban and admin force-end detach sockets and reject reconnect.
- Optional: load smoke for connected sockets and Redis adapter fan-out.
