# AUTH JWT Runbook

Operational reference for JWT authentication across Tycoon's HTTP (REST) and
WebSocket (realtime) surfaces. This runbook documents the **cookie/header
parsing parity** required by issue #1801 so that the GamesGateway handshake
accepts exactly the same credentials as the REST JWT strategy.

Related ADRs:

- `backend/docs/ADR-002-games-realtime-transport.md`
- `frontend/docs/ADR-004-session-tokens-httpOnly-cookies.md`

## 1. Token sources (parity contract)

The REST JWT strategy and the WebSocket handshake MUST resolve the bearer token
from the same ordered list of sources. Any divergence is a bug.

Resolution order (first match wins):

1. `Authorization: Bearer <jwt>` header.
2. `access_token` cookie (httpOnly, per ADR-004).
3. `token` cookie (legacy alias, kept for parity with older clients).

Rules:

- The `Authorization` header takes precedence over cookies when both are present.
- Cookie values are URL-decoded before verification.
- Empty, whitespace-only, or malformed values are treated as *absent* and fall
  through to the next source.
- The resolved token is verified with the **same** `JwtService` / strategy
  instance used by REST. Do not duplicate verification logic in the gateway.

## 2. WebSocket handshake

Browsers cannot set arbitrary headers on `WebSocket`, so the cookie path is the
primary transport for browser clients. Native/CLI clients may use the
`Authorization` header.

- The gateway extracts the token during the handshake (before `connection`).
- On success, the socket is bound to the authenticated principal and its role
  (`seat` or `spectator`).
- On failure, the handshake is rejected. **Deny-by-default**: an unauthenticated
  socket is never admitted and never receives broadcasts.

### Stable error codes

| Code | Meaning |
| --- | --- |
| `AUTH_MISSING_TOKEN` | No token found in any source. |
| `AUTH_INVALID_TOKEN` | Token present but failed verification. |
| `AUTH_EXPIRED_TOKEN` | Token verified but is past `exp`. |
| `AUTH_FORBIDDEN_ROLE` | Authenticated but role not permitted for the action. |

These codes are part of the client contract and must remain stable.

## 3. Authorization: seat vs spectator

- `seat` principals may submit game intents (e.g. `roll`).
- `spectator` principals may observe only. Any mutating intent is rejected with
  `AUTH_FORBIDDEN_ROLE` and dropped server-side.
- The server is the source of truth for outcomes; clients submit intents, never
  results.
- Hidden information (e.g. unrevealed cards) is never broadcast to spectators.

## 4. Token expiry mid-session

- Expiry is evaluated on every inbound action, not only at handshake.
- On expiry the socket receives `AUTH_EXPIRED_TOKEN` and is disconnected.
- Clients must re-authenticate and reconnect; reconnect resumes from a snapshot
  or replays events (see ADR-002).

## 5. Multi-instance delivery

- Use the Redis adapter so broadcasts reach sockets on all instances.
- If sticky sessions are required for a given deployment, document it in the
  deployment notes; otherwise the adapter handles fan-out.
- Redis pub/sub lag is tolerated by ordering events with monotonic sequence
  numbers; clients discard out-of-order or duplicate events.

## 6. Idempotency & reconnect

- Every mutating intent carries an idempotency key. Duplicate keys (reconnect
  retries, duplicate tabs) are de-duplicated server-side.
- Reconnect restores playability via snapshot resume or event replay.

## 7. Security checklist

- [ ] No secrets or tokens in logs; redact `Authorization` and cookie values.
- [ ] No PII in telemetry labels.
- [ ] Rate-limit `join` and `roll`.
- [ ] Metrics for connected sockets and rejected actions.
- [ ] Fail-closed on dependency outage (Postgres/Redis/shop-api/RPC) for writes.
- [ ] Deny-by-default for new WS/action surfaces.

## 8. Verification

- Unit: authz matrix for seat vs spectator.
- E2E: join / roll / reconnect, including `game-idempotency.e2e`.
- Confirm cookie-only, header-only, and both-present handshakes all succeed and
  resolve to the same principal.
