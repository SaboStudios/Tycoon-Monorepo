# Shop Architecture: Purchase Entity Field Mapping

**Status:** Documented (no code changes yet — see [ADR-003](../backend/docs/ADR-003-shop-purchase-field-mapping.md))
**Related:** [ADR-001 — Shop Purchase Write Path Ownership](../backend/docs/ADR-001-shop-purchase-ownership.md)

## Why this document exists

There are two independent `Purchase` entities today:

- `shop-api/src/purchases/entities/purchase.entity.ts` (shop-api's own Postgres DB)
- `backend/src/modules/shop/entities/purchase.entity.ts` (backend's Postgres DB)

They disagree on identifiers, units, and shape. Per ADR-001, `backend` will
eventually proxy all purchase writes to `shop-api`, but until that cutover is
complete, both write paths exist. This table is the single source of truth
for how a row on one side corresponds (or fails to correspond) to a row on
the other, so nobody has to guess and the frontend/inventory never silently
disagree about what was actually charged.

## Field mapping table

| Concern | `shop-api` Purchase | `backend` shop Purchase | Notes / mismatch |
|---|---|---|---|
| Primary key | `id: string` (UUID, `PrimaryGeneratedColumn('uuid')`) | `id: number` (auto-increment int, `PrimaryGeneratedColumn()`) | **Type mismatch.** No shared ID space — a shop-api purchase ID cannot be looked up directly in backend's `purchases` table and vice versa. A translator must carry both IDs (see below) rather than assume one implies the other. |
| Owner / player identity | `userId: string` | `user_id: number` + `user: User` (FK relation) | **Type + semantics mismatch.** shop-api's `userId` is an untyped string (could be any external identity system); backend's `user_id` is an internal FK into `users`. A translator must resolve shop-api's `userId` to a concrete backend `user_id` — never store one where the other is expected. |
| Item being purchased | `itemId: string` | `shop_item_id: number` + `shop_item: ShopItem` (FK relation) | **No shared catalog.** shop-api has no item catalog of its own; `itemId` is opaque. Requires an explicit SKU/item mapping table (or a shared catalog service) so `itemId` resolves to exactly one `shop_item_id`. |
| Quantity | *(not modeled — implicitly 1)* | `quantity: number` (default `1`) | shop-api's `CreatePurchaseDto` has no quantity field. A translator sending shop-api → backend must default to `1` or reject multi-quantity purchases until shop-api adds the field. |
| Amount charged | `amount: number` (`decimal(10,2)`, **major units**, e.g. `9.99`) | `unit_price` / `total_price` / `original_price` / `discount_amount` / `final_price` (all `decimal(10,2)` **major units** stored as `string`) | **Shape mismatch, not unit mismatch (currently).** Both sides use decimal major units (dollars, not cents) — good — but shop-api has one undifferentiated `amount` while backend distinguishes unit/total/discount/final price. A translator must decide which backend field `amount` maps to: **`final_price`** (the actual amount charged, after any discount) is the correct target; never map `amount` → `original_price` or `unit_price`, or discounted purchases will silently overcharge/undercharge on reconciliation. |
| Currency | *(not modeled — implicitly USD)* | `currency: string` (default `'USD'`) | shop-api assumes USD everywhere. If shop-api ever charges in another currency, `amount` MUST NOT be copied into `final_price` without also setting `currency` — this is the #1 silent-mismatch risk this doc exists to prevent. |
| Coupon / discount | *(not modeled)* | `coupon_id`, `coupon_code`, `discount_amount` | shop-api has no discount concept yet. Until it does, any backend purchase proxied through shop-api loses coupon context — flag this explicitly in the API contract rather than dropping it silently. |
| Payment method | *(not modeled — implicit)* | `payment_method: string` (default `'balance'`) | shop-api doesn't record how the purchase was paid for. Translator must set a default (`'balance'`) or thread the real value through if/when shop-api adds it. |
| Idempotency key | Stored separately in `idempotency_records.idempotencyKey` (shop-api's own table, not on `Purchase` itself) | `idempotency_key: string` (nullable column directly on `Purchase`, unique per `user_id`) | **Structural mismatch.** shop-api's idempotency key lives in a separate table keyed by the raw client key; backend stores it inline on the purchase row itself, scoped per user. A translator persisting a shop-api purchase into backend's table should populate `idempotency_key` from the original client-supplied key so backend's own unique index still protects against duplicates. |
| Status | `status: PurchaseStatus` enum: `PENDING` / `COMPLETED` / `FAILED` | `status: string` (free-form, default `'completed'`, lower-case) | **Casing + vocabulary mismatch.** shop-api is upper-case enum; backend is lower-case string with no enum. Map `COMPLETED` → `'completed'`, `FAILED` → `'failed'`; there is no backend equivalent for `PENDING` today — treat pending shop-api purchases as not-yet-visible to backend rather than inventing a status backend doesn't understand. |
| Gift purchase | *(not modeled)* | `is_gift: boolean`, `gift_id: number` | shop-api has no gifting concept. Default `is_gift: false`, `gift_id: null` when translating. |
| Metadata / extensibility | *(not modeled)* | `metadata: Record<string, unknown>` (JSON column) | Any shop-api-specific bookkeeping (e.g. original raw `itemId`, `userId` before resolution) that doesn't fit backend's schema should go here rather than being dropped, so a human can audit what happened. |
| Timestamps | `createdAt`, `updatedAt` (`CreateDateColumn`/`UpdateDateColumn`) | `created_at` only (`CreateDateColumn`, no update tracking) | Backend has no `updated_at` on `Purchase` — a translator cannot represent shop-api's `updatedAt` on the backend side today. |

## Example row, both sides

A single $9.99 purchase with a 10% coupon applied, translated shop-api → backend:

**shop-api `purchases` row:**

```json
{
  "id": "3fbd9a2e-8c1e-4f3a-9d2b-1a2b3c4d5e6f",
  "userId": "usr_8821",
  "itemId": "sku_gold_pack_100",
  "amount": "8.99",
  "status": "COMPLETED",
  "createdAt": "2026-08-30T12:00:00.000Z",
  "updatedAt": "2026-08-30T12:00:00.500Z"
}
```

with idempotency key `pk_live_20260830_8821_abcd1234` stored separately in
`idempotency_records`.

**Corresponding backend `purchases` row** (after resolving `userId` →
internal `user_id`, `itemId` → `shop_item_id`, and applying the mapping
above):

```json
{
  "id": 48213,
  "idempotency_key": "pk_live_20260830_8821_abcd1234",
  "user_id": 8821,
  "shop_item_id": 442,
  "quantity": 1,
  "unit_price": "9.99",
  "original_price": "9.99",
  "discount_amount": "1.00",
  "final_price": "8.99",
  "coupon_id": null,
  "coupon_code": null,
  "currency": "USD",
  "payment_method": "balance",
  "transaction_id": null,
  "status": "completed",
  "is_gift": false,
  "gift_id": null,
  "metadata": { "sourceService": "shop-api", "sourcePurchaseId": "3fbd9a2e-8c1e-4f3a-9d2b-1a2b3c4d5e6f" },
  "created_at": "2026-08-30T12:00:00.000Z"
}
```

Note `final_price` (`8.99`) — not `unit_price`/`original_price` (`9.99`) —
is what shop-api's undifferentiated `amount` maps to, and `metadata` records
the shop-api-side purchase ID for audit/reconciliation since the two
primary keys are unrelated.

## No silent unit mismatch

Both entities currently store major units (dollars) as decimal, so there is
**no currency-minor-units bug today** — but there is no shared type or
validation enforcing this. Any translator implementation MUST:

1. Assert `currency === 'USD'` (or explicitly handle non-USD) before mapping.
2. Never assume `amount` and `final_price` are interchangeable in the other
   direction without confirming which backend price field is authoritative
   (`final_price`, as documented above).
3. Fail loudly (not silently default) if `itemId` cannot be resolved to a
   `shop_item_id`, or if `userId` cannot be resolved to a `user_id`.

## Translator vs. shared DTO package

Given the ID-space and shape differences above, a **shared DTO package** is
not viable as an immediate fix — the two entities are structurally too
different (backend's is a full commerce record, shop-api's is a minimal
idempotent-write record). The recommended near-term approach is an
**explicit translator function** (e.g.
`toBackendPurchase(shopApiPurchase, resolvedUserId, resolvedShopItemId): BackendPurchaseInput`)
that implements exactly the mapping in this document, with unit tests
asserting each row of the table above. See ADR-003 for the decision record.
