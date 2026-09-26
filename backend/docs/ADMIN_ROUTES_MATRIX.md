# Admin Routes Matrix

This document is the source of truth for admin-only HTTP surfaces, their
authorization requirements, and the invariants they must uphold. It is
referenced by the in-game chat moderation ADR (see
`docs/adr/ADR-CHAT-MODERATION.md`) and by the API error standards in
`docs/API_ERROR_RESPONSE_STANDARDS.md`.

## Authorization model

- All admin routes are **deny-by-default**. A route is only reachable when it
  is explicitly listed below with a required guard.
- `AdminGuard` (JWT + role claim) is mandatory for every admin mutation.
  Service-to-service callers must present a scoped API key in addition to the
  guard; API keys never grant role escalation on their own.
- WebSocket admin/seat actions are validated server-side against the seat
  token issued at join time. Clients cannot self-assert a moderator seat.
- The server is the sole source of truth for moderation state. Client-supplied
  actor ids, roles, or timestamps are ignored and re-derived from the
  authenticated principal.

## Error codes

Admin and moderation routes map failures to the codes defined in
`docs/API_ERROR_RESPONSE_STANDARDS.md`:

| Condition | HTTP | Code |
| --- | --- | --- |
| Missing/invalid credentials | 401 | `AUTH_UNAUTHENTICATED` |
| Authenticated but not an admin/moderator | 403 | `AUTH_FORBIDDEN` |
| Unknown target (player, message, room) | 404 | `RESOURCE_NOT_FOUND` |
| Invalid or adversarial payload | 422 | `VALIDATION_FAILED` |
| Duplicate/idempotent replay | 200 | (idempotent no-op) |
| Dependency outage on a write | 503 | `DEPENDENCY_UNAVAILABLE` |

Writes fail closed: if Postgres/Redis/shop-api/RPC is unavailable, the
moderation mutation is rejected with `DEPENDENCY_UNAVAILABLE` rather than
silently succeeding.

## Chat moderation routes

| Method | Path | Guard | Notes |
| --- | --- | --- | --- |
| `POST` | `/admin/chat/messages/:id/redact` | `AdminGuard` | Redacts a message; idempotent by message id. |
| `POST` | `/admin/chat/players/:id/mute` | `AdminGuard` | Applies a timed mute; requires `durationSeconds` and `reason`. |
| `POST` | `/admin/chat/players/:id/unmute` | `AdminGuard` | Lifts an active mute; idempotent. |
| `POST` | `/admin/chat/players/:id/ban` | `AdminGuard` | Bans a player from chat; requires `reason`. |
| `GET`  | `/admin/chat/reports` | `AdminGuard` | Lists pending abuse reports (paginated). |

### Invariants for chat abuse controls

1. **Server authority** — moderation decisions are computed and persisted on
   the server. The client only renders the resulting state.
2. **Deny-by-default** — any new moderation surface must be added to this
   matrix with an explicit guard before it can be enabled.
3. **Fail-closed writes** — moderation writes never partially apply; on
   dependency failure the request is rejected and no state changes.
4. **Idempotency** — redact/unmute/ban accept a client-supplied idempotency
   key; concurrent duplicate requests and reconnect retries resolve to a
   single applied mutation.
5. **Auditability** — every moderation action emits a structured log with
   `requestId`/correlation id and the acting admin id. Tokens and PII are
   redacted from telemetry labels.
6. **Rate limiting** — moderation entrypoints are rate-limited per admin
   principal to bound abuse and accidental loops.

## Kill switch

Chat moderation mutations are gated behind the `CHAT_MODERATION_ENABLED`
feature flag. When disabled, the routes return `503 DEPENDENCY_UNAVAILABLE`
and the in-game chat falls back to read-only. This provides a rollback path
without a redeploy.

## Related documents

- `docs/adr/ADR-CHAT-MODERATION.md` — design note and invariants.
- `docs/API_ERROR_RESPONSE_STANDARDS.md` — canonical error codes.
- `docs/adr/ADR-003-near-wallet.md` — NEAR is the only supported chain UI
  until Stellar is explicitly gated ready.
