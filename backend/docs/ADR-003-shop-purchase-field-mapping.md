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

## Consequences

- No entity code changes in this ADR — this is a documentation and process
  decision. Any PR that writes purchase data across the shop-api/backend
  boundary must reference and follow `docs/SHOP_ARCHITECTURE.md`.
- Follow-up work (out of scope here): implement and unit-test the actual
  translator function once ADR-001's proxy cutover work begins.
