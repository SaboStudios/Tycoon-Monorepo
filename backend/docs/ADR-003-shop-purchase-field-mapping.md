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
    the original status code. No second purchase is created.
  - **Conflict (same key, different body hash):** return `409 Conflict`.
    The stored record is never overwritten.
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
   (or proxy) that evaluates flags server-side and returns the resolved
   booleans. The frontend consumes that response; it does not evaluate
   flags itself and does not trust any client-provided flag value.
4. **ADR-003 chain policy.** While `stellar.ui` is `false`, the UI must
   present NEAR as the only supported chain. Enabling `stellar.ui` is an
   explicit operator action and must be accompanied by the Stellar
   readiness checklist; it is not implied by any other flag.
5. **WS gate.** The shop proxy games WS surface must reject connections
   when `shop.proxy.games.ws` is `false`, using the same deny-by-default
   evaluation as the read path.

### Rollback

Disabling either flag returns the surface to its default-off state without
requiring a deploy. Rollback notes for the enabling PR must state which
flag was flipped, the observed metrics, and the revert action.

## Consequences

- No entity code changes in this ADR — this is a documentation and process
  decision. Any PR that writes purchase data across the shop-api/backend
  boundary must reference and follow `docs/SHOP_ARCHITECTURE.md`.
- Follow-up work (out of scope here): implement and unit-test the actual
  translator function once ADR-001's proxy cutover work begins.
- Feature-flag evaluation for `shop.proxy.games.ws` and `stellar.ui` is
  owned by the backend flag service; any new admin/WS/action surface added
  under these flags is deny-by-default and must be authorized and
  rate-limited at the server.
