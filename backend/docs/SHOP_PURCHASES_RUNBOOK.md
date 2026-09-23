# Operational Runbook: Shop & Purchases

## Overview
This runbook covers the operational procedures for managing the Tycoon Shop and Purchases module, including troubleshooting failed transactions, managing coupons, and auditing financial activity.

## Authoritative Write Path

`shop-api` is the **single source of truth** for purchases, inventory, and money.
All purchase writes MUST go through `shop-api`; the backend never mutates
inventory or balances directly.

-   **Write path**: client → `shop-api` `POST /shop/purchase` (authoritative).
-   **Backend proxy/read models**: the backend may proxy reads (catalog, user
    inventory) and expose read models for admin reconciliation, but it MUST NOT
    write purchases, inventory, or balances. Any backend proxy is read-only and
    forwards the caller's `Authorization` and `requestId`.
-   **Admin reconciliation tools** (shop and pots) are read-only views over
    `shop-api` + the internal ledger. Admin mutations (catalog edits, item
    deactivation) are audited and go through `shop-api` admin endpoints only.

## Common Issues & Troubleshooting

### 1. Failed Purchases
If a user reports a failed purchase but claims they were charged (or vice versa):
1.  **Check Audit Logs**:
    ```sql
    SELECT * FROM audit_trails 
    WHERE action = 'PURCHASE_CREATED' 
    AND user_id = <USER_ID> 
    ORDER BY created_at DESC;
    ```
2.  **Verify Ledger**: Check the `ledger_reconciliation` module/logs to see if the transaction was recorded in the internal ledger.
3.  **Inventory Check**: Verify if the item exists in the user's inventory:
    ```sql
    SELECT * FROM user_inventories 
    WHERE user_id = <USER_ID> 
    AND shop_item_id = <ITEM_ID>;
    ```

### 2. Invalid Coupon Errors
If coupons are not working as expected:
-   **Expiry**: Check `valid_until` in the `coupons` table.
-   **Usage Limit**: Check if `usage_count` has reached `max_usages`.
-   **Scope**: Ensure the coupon is valid for the specific `shop_item_id`.

### 3. Inventory Out of Sync
If a user cannot see their purchased items:
-   The cache might be stale. Invalidate the shop cache for the user:
    -   Redis Key: `shop:inventory:<USER_ID>`
    -   Action: `DEL shop:inventory:<USER_ID>`

### 4. Duplicate Purchase Reports (Idempotency)
`POST /shop/purchase` **requires** an `Idempotency-Key` header and is wrapped with
`IdempotencyInterceptor` (`src/modules/redis/idempotency.interceptor.ts`) to ensure
exactly-once semantics matching `shop-api`'s implementation:

#### Idempotency Header
-   **Header Name**: `Idempotency-Key` (case-insensitive for `idempotency-key` and `x-idempotency-key`)
-   **Requirement**: Required for all purchase requests
-   **Format**: Any unique string, typically UUID (e.g., `550e8400-e29b-41d4-a716-446655440000`)
-   **Max Length**: 255 characters

#### State Machine
-   **Claim**: On a new key, the request is marked `processing` in Redis (`idempotency:<key>`, 24h TTL) before the handler runs.
-   **Complete**: On success, the response is cached and replayed (with `X-Idempotency-Replayed: true` header) for any repeat request using the same key.
-   **Fail**: If the handler throws, the key is deleted so the client can safely retry with the same key.

#### Body Hash & Payload Conflict
Each claim stores a hash of the request body alongside the key. On replay:
-   **Same key + same body hash**: stored response is replayed (no new charge).
-   **Same key + different body hash**: `409 Conflict` — the key was already used
    for a different payload. Clients MUST use a new `Idempotency-Key` for a
    genuinely different purchase.

#### Response Scenarios

| Scenario | Status | Header | Behavior |
|----------|--------|--------|----------|
| **First request** | 201 | None | Purchase processed; item added to inventory |
| **Duplicate (completed, same body)** | 201 | `X-Idempotency-Replayed: true` | Cached response replayed; no new charge |
| **Duplicate (in-flight)** | 409 | None | Original request still processing; client must retry |
| **Same key, different body** | 409 | None | Payload conflict; use a new key |
| **No Idempotency-Key** | 400 | None | Rejected — header is required |

#### Examples

**First purchase request** (success):
```bash
curl -X POST http://localhost:3000/shop/purchase \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_item_id": 42,
    "quantity": 1,
    "coupon_code": "SAVE10"
  }'
```

Response (201 Created):
```json
{
  "id": 123,
  "user_id": 456,
  "shop_item_id": 42,
  "quantity": 1,
  "final_price": "9.99",
  "status": "completed",
  "created_at": "2026-08-26T10:30:00Z"
}
```

**Duplicate request (replay)** — same Idempotency-Key, original has completed:
```bash
curl -X POST http://localhost:3000/shop/purchase \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_item_id": 42,
    "quantity": 1,
    "coupon_code": "SAVE10"
  }'
```

Response (201 Created, **X-Idempotency-Replayed: true**):
```
X-Idempotency-Replayed: true
```
```json
{
  "id": 123,
  "user_id": 456,
  "shop_item_id": 42,
  "quantity": 1,
  "final_price": "9.99",
  "status": "completed",
  "created_at": "2026-08-26T10:30:00Z"
}
```
**Note**: Same response body and purchase ID; no new charge; item not added again.

**Concurrent duplicate request** — same Idempotency-Key, original still in-flight:
```bash
curl -X POST http://localhost:3000/shop/purchase \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{
    "shop_item_id": 42,
    "quantity": 1
  }'
```

Response (409 Conflict):
```json
{
  "statusCode": 409,
  "message": "Request is still being processed",
  "error": "Conflict"
}
```
**Action**: Client should wait 1–5 seconds and retry, or use a different `Idempotency-Key` for a new purchase.

#### Troubleshooting
If a user reports being charged twice for what they believe was one click:
1.  **Check client logs** for the `Idempotency-Key` sent on both requests.
2.  **If same key**: The second request should have been idempotent. Check audit logs to confirm if two distinct purchase records were created or if the second was a replay.
3.  **If different keys**: This is expected behavior — two independent purchases with two different keys are not deduplicated (see Section 1 for refund procedures).

### 5. Concurrent Checkout of the Same SKU
Inventory is adjusted **atomically** in `shop-api` (row-level constraint /
reservation with TTL) so concurrent buys of the same SKU cannot oversell.
-   **Inventory never negative**: if the atomic decrement fails, the purchase is
    rejected with `409 Conflict` and no charge is recorded.
-   **Reservation TTL**: reservations that are not confirmed within the TTL are
    released back to available stock automatically.
-   **Catalog edit during purchase**: a purchase in flight uses the price/SKU
    snapshot captured at claim time; a concurrent catalog edit does not change
    the price of an in-flight purchase.

### 6. shop-api Unavailable (Fail-Closed)
On any write, if `shop-api` (or its Postgres/Redis dependency) is unavailable,
the backend **fails closed**: the request is rejected with `503 Service
Unavailable` and no inventory or balance mutation occurs. Clients may retry with
the **same** `Idempotency-Key` once `shop-api` recovers.

### 7. Idempotency TTL Expiry Reuse
Idempotency keys expire after 24h. Reusing an expired key is treated as a new
request — clients MUST NOT reuse keys across days. If a client retries after TTL
expiry, a new purchase may be created; reconcile via the audit log (Section 1).

## Operational Procedures

### Deactivating a Malfunctioning Shop Item
If an item is causing issues (e.g., incorrect pricing), deactivate it immediately:
```sql
UPDATE shop_items SET active = false WHERE id = <ITEM_ID>;
```
This is preferred over deletion to preserve historical purchase records.

### Refunding a Purchase
Currently, refunds are handled manually by:
1.  Removing the item from `user_inventories`.
2.  Crediting the user's balance (if applicable).
3.  Logging the action in `audit_trails` with a reason.

### Ledger Reconciliation (Shop & Pots)
Admin reconciliation tools are **read-only** and surface mismatches between
`shop-api` purchases and the internal ledger:
1.  List purchases for a window and compare against ledger entries.
2.  Flag purchases with no matching ledger entry (and vice versa).
3.  Export the mismatch set for finance review; do not mutate from the tool.

## Monitoring & Metrics
-   **Metric**: `tycoon_purchases_total` - Track successful vs failed purchases.
-   **Metric**: `tycoon_coupon_usage_total` - Monitor marketing campaign effectiveness.
-   **Metric**: `tycoon_purchase_duration_seconds` - RED latency histogram for the purchase path.
-   **Metric**: `tycoon_purchase_errors_total` - RED error counter, labeled by mapped error code (no PII).

## Support Contacts
-   Backend Team: #team-backend
-   Finance/Operations: #ops-billing
