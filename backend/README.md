# Tycoon Backend (NestJS 11)

This package hosts the Tycoon HTTP/WebSocket API. It is the server source of truth for
game state, dice, inventory, and admin mutations. Untrusted clients must never be able
to bypass server authority.

## In-game chat moderation (ADR-1786)

### Status

In-game chat is **disabled by default** until moderation controls are enabled for an
environment. This is an explicit, documented disable rather than an implicit gap: the
server refuses to accept chat writes unless moderation is configured, so no
unmoderated player-facing chat can ship by accident.

### Invariants

- **Server authority.** All chat writes (send, edit, delete, mute, ban) are validated
  and persisted server-side. Clients cannot mutate chat state directly; the WebSocket
  layer only relays server-accepted events.
- **Deny-by-default.** Moderation actions require an authenticated principal with an
  explicit moderator/admin role. Missing or unknown roles are rejected, not defaulted.
- **Fail-closed on writes.** If the moderation store (Postgres/Redis) or the auth
  dependency is unavailable, chat writes are rejected rather than buffered or accepted
  optimistically. Reads may degrade, writes may not.
- **Idempotency.** Moderation mutations carry a client-supplied idempotency key so
  reconnect retries and duplicate requests do not double-apply (e.g. double mute/ban).
- **Bounded input.** Message length, channel identifiers, and moderation payloads are
  size- and enum-validated before any persistence or fanout.

### Error codes

Chat and moderation endpoints return the standard error envelope defined in
[`docs/API_ERROR_RESPONSE_STANDARDS.md`](../docs/API_ERROR_RESPONSE_STANDARDS.md),
including a `requestId` for correlation. Representative codes:

| Code | Meaning |
| --- | --- |
| `CHAT_DISABLED` | Chat is not enabled for this environment (explicit disable). |
| `CHAT_FORBIDDEN` | Caller lacks the required moderator/admin role. |
| `CHAT_INVALID_INPUT` | Payload failed size/enum validation. |
| `CHAT_UNAVAILABLE` | Moderation dependency unavailable; write failed closed. |
| `CHAT_DUPLICATE` | Idempotency key already applied; original result returned. |

### Authz

- HTTP moderation routes are guarded by the JWT auth guard plus an admin/moderator
  role guard (`AdminGuard`).
- WebSocket moderation actions re-check the seat/role on the server for every event;
  the client-provided role is never trusted.
- Service-to-service callers use the API-key guard and are still subject to role checks.

### Observability

- Every user-facing moderation path logs with the request `requestId`/correlation id.
- Metrics are emitted for accepted/rejected moderation actions and for fail-closed
  dependency errors. Labels never contain tokens, message bodies, or other PII.

### Feature flag / rollback

Chat moderation is gated behind an environment flag. Disabling the flag returns the
service to the explicit-disable state (`CHAT_DISABLED`) without a deploy, which is the
rollback path for this work.

## Chain support

NEAR wallet is the only supported chain UI per ADR-003. Stellar/Soroban code in this
repo is scaffolding and must not be presented as ready until it is explicitly gated
ready. Do not add player-facing copy claiming Stellar support.
