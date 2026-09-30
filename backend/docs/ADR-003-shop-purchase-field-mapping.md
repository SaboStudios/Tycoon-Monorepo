# ADR-003: shop-api ↔ backend Purchase Entity Field Mapping

**Status:** Decided
**Date:** 2026-08-30
**Author:** Stellar Wave
**Issue:** #1494
**Related:** [ADR-001 — Shop Purchase Write Path Ownership](./ADR-001-shop-purchase-ownership.md)

## Problem Statement

`shop-api/src/purchases/entities/purchase.entity.ts` and
`backend/src/modules/shop/entities/purchase.entity.ts` model the same
real-world concept — a purchase — with different primary keys, different
identity fields (`userId` vs `user_id`/`user`), different item references
(`itemId` vs `shop_item_id`/`shop_item`), and different price shapes (one
undifferentiated `amount` vs `unit_price`/`original_price`/`discount_amount`/
`final_price`). Until ADR-001's proxy migration is complete, both tables can
be written to independently, and nothing enforces that a purchase recorded
on one side agrees with the other. Left undocumented, this produces exactly
the failure mode this issue was opened to prevent: the frontend shows
backend inventory (via `backend`'s purchase records) while `shop-api`
believes a different amount was charged.

## Decision

Document the full field-by-field mapping and translation rules in
[`docs/SHOP_ARCHITECTURE.md`](../../docs/SHOP_ARCHITECTURE.md) at the repo
root, and require any future integration code to implement an **explicit
translator function**, not a shared DTO package.

### Why a translator, not a shared DTO

A shared DTO/package was considered and rejected for now:

- The two entities are structurally different in kind, not just naming —
  backend's `Purchase` is a full commerce record (coupons, gifts, payment
  method, catalog relations); shop-api's is a minimal idempotent-write
  record with no catalog of its own.
- The primary keys live in different ID spaces (UUID vs auto-increment int)
  and cannot be unified without a migration on one side.
- A shared type would either have to be a lossy common subset (defeating
  the purpose) or grow superset fields that don't apply to shop-api,
  reintroducing the "two things pretending to be one" problem ADR-001
  already flagged for the write path itself.

An explicit, unit-tested translator function keeps the mapping visible,
reviewable, and testable in one place, and can evolve independently of
either entity's schema.

### Key decisions captured in the mapping doc

1. shop-api's `amount` maps to backend's `final_price` (post-discount), not
   `unit_price` or `original_price` — mapping to the wrong field would
   silently overcharge/undercharge on any purchase with a discount applied.
2. Currency is assumed USD on both sides today; the translator must assert
   this explicitly rather than assume it forever.
3. `userId`/`itemId` (shop-api, opaque strings) must be resolved to
   `user_id`/`shop_item_id` (backend, FK integers) before a translated row
   can be written — unresolvable IDs must fail loudly, never default to a
   guessed value.
4. shop-api's idempotency key (stored in a separate `idempotency_records`
   table) should populate backend's inline `Purchase.idempotency_key`
   column when translating, so backend's own unique index continues to
   protect against duplicates.

See the mapping doc for the full table and a worked example row on both
sides.

## Purchase Write Path Contract (issue #1727)

This section records the authoritative write-path contract for the shop
purchase flow. It is the source of truth for the idempotency, inventory,
validation, and telemetry behavior that the shop grid a11y/strictness work
depends on. Any PR touching the purchase path must conform to it.

### Authoritative write path

- **shop-api is the source of truth for purchases.** All purchase writes
  (create, replay, conflict) are handled by `shop-api`'s purchases module.
- The backend does **not** write purchases directly. Any backend surface
  that needs purchase data reads it through the shop-api proxy/read model
  defined by ADR-001; it never mutates purchase or inventory state itself.
- The frontend never computes or trusts a client-supplied price. Prices are
  resolved server-side from the catalog at write time.

### Idempotency

- Every purchase write must carry an `Idempotency-Key` header. Requests
  without one are rejected (fail-closed) rather than treated as new writes.
- The key is stored together with a hash of the request body.
  - **Replay (same key, same body hash):** return the stored response with
    the original status code (`201` for purchase creation). No second
    purchase is created.
  - **Conflict (same key, different body hash):** return `409 Conflict`.
    The stored record is never overwritten.
  - `409` is not a replay-success response. Backend adapters preserve it as
    a conflict; only a completed replay returns the stored success response.
- Idempotency records have a TTL. After TTL expiry the key may be reused;
  operators must treat a post-TTL reuse as a new write, and the runbook
  documents the TTL value and the resulting replay window.

### Inventory atomicity

- Inventory is adjusted atomically with the purchase write (single
  transaction, or a reservation with a TTL that is committed or released).
- Concurrent checkouts of the same SKU must not oversell: the inventory
  constraint (or reservation) is enforced at the database level, not in
  application code alone.
- Inventory must never go negative. A failed constraint aborts the whole
  purchase transaction; no partial purchase is persisted.
- A catalog edit during an in-flight purchase must not change the price or
  inventory already reserved for that purchase.

### DTO validation

- Purchase DTOs validate `sku`, `quantity`, and minor-unit amounts
  explicitly. Amounts are integers in minor units; floats are rejected.
- Unknown fields are rejected per policy (no silent stripping), so
  adversarial or spoofed payloads fail validation instead of being
  partially applied.
- Oversized payloads and enumeration attempts are rejected at the edge and
  rate-limited; every external entrypoint touched by this work is
  authorized and rate-limited server-side.

### Error mapping, requestId, and telemetry

- The incoming `requestId` is propagated through the write path and echoed
  in responses and logs so a purchase can be traced end to end.
- Errors are mapped to `docs/API_ERROR_RESPONSE_STANDARDS.md`. Dependency
  outages (Postgres/Redis/shop-api/RPC) fail closed on writes — no
  best-effort write is attempted.
- RED metrics (rate, errors, duration) are emitted for the purchase
  operation. Telemetry labels must not contain secrets, tokens, or PII.

### Auth

- Auth expiry mid-flow and forbidden-role access are rejected server-side.
- Service-to-service calls use API keys only; no client-trusted price or
  client-trusted inventory is accepted.
- Admin catalog mutations are audited.

## Proxy Abort on Client Disconnect for Shop Writes (issue #1780)

This section records the contract for how the backend shop proxy behaves
when the client disconnects mid-write. It extends the write-path contract
above; it does not change shop-api's ownership of purchases.

### Rule: client disconnect aborts the proxy request, never the write

- The backend proxy is a **read model / forwarder only**. It must never
  become the writer of record, and it must never retry a write on the
  client's behalf.
- When the client disconnects (socket close, navigation, timeout) while a
  shop write is in flight, the proxy **aborts its own outbound request to
  shop-api** and stops waiting. It does not attempt to complete, retry, or
  compensate the write.
- The abort is a transport concern only. It must **not** be translated into
  a shop-api-side cancellation of an already-accepted write: once shop-api
  has accepted the request, the purchase and its inventory adjustment
  proceed to completion regardless of the client's connection state.
- The proxy must not surface a client-disconnect abort as a `5xx` to
  telemetry as if shop-api failed. Aborts are recorded as client aborts
  (a distinct outcome label), so RED metrics for the purchase operation
  stay accurate and do not page on normal user navigation.

### Idempotency makes the abort safe to retry

- Because every write carries an `Idempotency-Key` with a body hash, a
  client that reconnects and retries after an abort is safe:
  - If shop-api already committed the write, the retry is a **replay** and
    returns the stored `201` response. No second purchase is created.
  - If shop-api never received the write, the retry is a fresh write.
  - A retry with a different body under the same key is a `409 Conflict`,
    exactly as in the write-path contract above.
- The proxy must forward the client's `Idempotency-Key` unchanged. It must
  never generate, rewrite, or drop the key, and it must never synthesize a
  key on the client's behalf — doing so would defeat replay protection and
  allow double purchases.
- The proxy must not cache or replay a stored response itself. Replay is
  shop-api's responsibility; the proxy only forwards.

### Fail-closed behavior

- If the proxy cannot reach shop-api (outage, timeout, connection refused),
  the write fails closed: the client receives an error mapped per
  `docs/API_ERROR_RESPONSE_STANDARDS.md`, and no best-effort write is
  attempted.
- A client disconnect must never be treated as a successful write. The
  proxy does not fabricate a success response for an aborted request.
- `requestId` is propagated on the outbound request even when the client
  disconnects, so shop-api logs and the proxy logs can be correlated for
  the aborted attempt.

### Operator notes

- A spike in client-abort outcomes is a client/network signal, not a
  shop-api incident. Operators should not treat it as a purchase failure.
- A spike in `409 Conflict` on the purchase path indicates clients reusing
  an `Idempotency-Key` with a changed body; see
  `SHOP_PURCHASES_RUNBOOK.md` for the triage steps.
- Because aborted writes may still commit on shop-api, reconciliation must
  read from shop-api (the source of truth), never from the proxy's view of
  the aborted request.

## Feature Flags: shop proxy games WS and Stellar UI gate

This ADR also records the flag contract that gates the shop proxy games
WebSocket surface and the Stellar UI, per issue #1806. The flag service is
the single server-side source of truth; clients must never decide on their
own whether Stellar UI or the games WS surface is available.

### Flag names and defaults

| Flag | Surface | Default | Notes |
| --- | --- | --- | --- |
| `shop.proxy.games.ws` | shop proxy games WebSocket | `false` | Deny-by-default; enabling exposes the WS proxy surface. |
| `stellar.ui` | Stellar UI gate | `false` | ADR-003 chain policy: NEAR is the only supported chain UI until this flag is explicitly enabled. |

### Evaluation rules

1. **Deny-by-default.** Unknown, missing, or unevaluable flags resolve to
   `false`. There is no implicit enable path.
2. **Fail-closed on dependency outage.** If the flag store (Postgres/Redis)
   is unreachable, evaluation returns the default (`false`) and records a
   metric; it never falls back to a cached `true` or to client-supplied
   state.
3. **Server-side only.** The authoritative read path is a backend endpoint
   (or proxy) that evaluates flags server-side; clients receive the
   resolved boolean and must not evaluate flags themselves.
