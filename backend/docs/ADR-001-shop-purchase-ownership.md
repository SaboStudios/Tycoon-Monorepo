# ADR-001: Shop Purchase Ownership (Authoritative Write Path)

- Status: Accepted
- Date: 2024-01-01
- Related: ADR-003 (NEAR wallet is the only supported chain UI), `docs/API_ERROR_RESPONSE_STANDARDS.md`, `docs/SHOP_PURCHASES_RUNBOOK.md`

**Status:** Decided  
**Date:** 2026-08-26  
**Author:** Backend Team  
**Issue:** #1432  
**Related:** #1710 (Ledger reconciliation admin tools for shop and pots)

## Context

Tycoon has two server-side surfaces that can touch purchase state:

- `shop-api` (NestJS): the purchases system-of-record (SoT). Owns SKU catalog reads, inventory mutation, idempotency records, and purchase persistence.
- `backend` (NestJS): the general API. May expose read models and a thin proxy for shop operations, but must not own purchase state.

Without an explicit decision, purchase writes can be duplicated across surfaces, inventory can be adjusted twice, and error envelopes can diverge between `backend` and `shop-api`.

## Decision

1. **`shop-api` is the authoritative write path for all purchases.** Every purchase mutation (create, refund, inventory adjustment) is executed by `shop-api` against its own datastore. No other service writes purchase or inventory state directly.

2. **`backend` is read-only for purchases.** It may expose read models (catalog, purchase history) and, if needed, a thin proxy that forwards to `shop-api`. A proxy must:
   - Forward the caller's `Idempotency-Key` unchanged.
   - Propagate `requestId` on both success and error responses.
   - Never trust client-supplied price, SKU totals, or inventory counts.
   - Fail closed on writes when `shop-api` is unavailable (return an error envelope, do not fall back to local writes).

3. **Error envelope is shared.** Both `backend` and `shop-api` MUST emit the envelope defined in `docs/API_ERROR_RESPONSE_STANDARDS.md`:

   ```json
   {
     "error": {
       "code": "STRING_CODE",
       "message": "Human readable message",
       "requestId": "<propagated request id>",
       "details": { }
     }
   }
   ```

   - `code` is a stable, machine-readable string (e.g. `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `DEPENDENCY_UNAVAILABLE`).
   - `requestId` is always present and matches the value in logs for the same request.
   - `details` is optional and must not contain secrets, tokens, or PII.

4. **Idempotency.** Purchase writes require an `Idempotency-Key` header. `shop-api` stores the key together with a hash of the request body:
   - Replay with the same key and same body hash returns
   }
   ```

   - `code` is a stable, machine-readable string (e.g. `VALIDATION_FAILED`, `IDEMPOTENCY_CONFLICT`, `DEPENDENCY_UNAVAILABLE`).
   - `requestId` is always present and matches the value in logs for the same request.
   - `details` is optional and must not contain secrets, tokens, or PII.

4. **Idempotency.** Purchase writes require an `Idempotency-Key` header. `shop-api` stores the key together with a hash of the request body:
   - Replay with the same key and same body hash returns the stored response.
   - Replay with the same key and a different body hash returns `409` with code `IDEMPOTENCY_CONFLICT`.
   - Keys expire per the TTL documented in `docs/SHOP_PURCHASES_RUNBOOK.md`; after expiry a new request is treated as a fresh purchase.

5. **Inventory integrity.** Inventory adjustments are atomic (constraint or reservation with TTL) so concurrent purchases of the same SKU cannot oversell. Inventory must never go negative.

6. **Fail-closed on dependency outage.** If Postgres, Redis, `shop-api`, or the RPC dependency is unavailable, purchase writes return an error envelope with code `DEPENDENCY_UNAVAILABLE` and HTTP `503`. Reads may degrade, writes must not.

## Consequences

- A single writer (`shop-api`) makes inventory and idempotency reasoning tractable.
- `backend` proxy code stays thin and testable; contract tests assert envelope and `requestId` propagation.
- Operators have one runbook (`docs/SHOP_PURCHASES_RUNBOOK.md`) for purchase incidents.
- Any future service that needs to mutate purchases must go through `shop-api` or supersede this ADR.

## Out of scope

- Mainnet irreversible deploys without a readiness issue.
- Unrelated package refactors.
- Stellar chain UI (gated by ADR-003; NEAR remains the only supported chain UI).

### Option B: Backend → shop-api via Service Token
- Backend has its own service account in shop-api's auth system
- Backend creates an internal service token on startup
- Backend forwards the token + user context to shop-api
- ✅ Cleaner separation; shop-api doesn't see user JWTs
- ⚠️ Requires shop-api to trust backend's user context (need validation)

**Recommendation: Option A initially** (JWT passthrough), migrate to Option B once both services are under one ops team and have mTLS in place.

---

## Idempotency Key Mapping

**Backend receives:**
```http
POST /shop/purchase
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "shop_item_id": 42,
  "quantity": 1
}
```

**Backend proxies to shop-api:**
```http
POST /purchases
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json
Authorization: Bearer <user-jwt>

{
  "userId": 456,
  "itemId": 42,
  "amount": "9.99",
  "currency": "USD",
  "metadata": {
    "quantity": 1,
    "coupon_code": null,
    "source": "backend"
  }
}
```

**Idempotency is guaranteed by:**
- Same key in both requests → shop-api deduplicates
- shop-api's idempotency record acts as the authoritative cache
- Backend never creates local duplicates (all writes go through shop-api)

### Idempotency-Key + body hash (issue #1710)

To prevent key reuse with a different payload (a common reconciliation break), shop-api stores a hash of the canonical request body alongside the idempotency key:

1. On first request: compute `bodyHash = sha256(canonicalJson(body))`, persist `(key, bodyHash, response, status, expiresAt)`.
2. On replay with the **same** key and **same** `bodyHash`: return the stored response with `x-idempotency-replayed: true` (no new ledger rows).
3. On replay with the **same** key but a **different** `bodyHash`: return **409 Conflict** with `code: IDEMPOTENCY_KEY_REUSED` — never overwrite the stored response.
4. TTL: idempotency records expire after 24h. After expiry, a reused key is treated as a new request; operators must reconcile via the admin tooling below.

---

## Inventory Atomicity (issue #1710)

Concurrent buys of the same SKU must never oversell and inventory must never go negative:

- Inventory decrement happens **inside the same shop-api transaction** as the purchase insert.
- The row is locked with `SELECT ... FOR UPDATE` (or an equivalent `UPDATE ... WHERE quantity >= :qty` guarded statement) so two concurrent transactions serialize.
- If the guarded update affects 0 rows, shop-api returns **409 Conflict** with `code: INSUFFICIENT_INVENTORY` and rolls back — no partial ledger entry.
- Optional reservation TTL: a short-lived reservation row (`expiresAt`) holds stock during checkout; expired reservations are released by a sweeper and are visible in the reconciliation read model.

---

## Admin Reconciliation Tooling (issue #1710)

Operators reconcile shop and pot ledgers through backend admin endpoints (deny-by-default, admin role required, every mutation audited):

| Endpoint | Method | Purpose |
|---|---|---|
| `/admin/ledger/reconciliation` | GET | List purchase/pot ledger entries with filters (`status`, `from`, `to`, `sku`, `potId`) |
| `/admin/ledger/reconciliation/:id` | GET | Drill-down for a single entry, including `requestId` and idempotency key |
| `/admin/ledger/reconciliation/:id/notes` | POST | Attach an operator note (audited) |
| `/admin/ledger/reconciliation/:id/resolve` | POST | Mark an entry reconciled (audited, idempotent) |

All admin responses propagate `requestId` and follow `docs/API_ERROR_RESPONSE_STANDARDS.md`. RED metrics (`ledger_reconciliation_requests_total`, `_errors_total`, `_duration_seconds`) are emitted for every admin call.

---

## Error Handling

| shop-api Response | Backend → Client |
|---|---|
| 201 Created | 201 Created (mapped payload) |
| 201 + x-idempotency-replayed | 201 + x-idempotency-replayed (replay detected) |
| 409 Conflict | 409 Conflict (request in-flight) |
| 400 Bad Request | 400 Bad Request (validation error) |
| 500 Server Error | 503 Service Unavailable (shop-api down) |
| Network timeout (>5s) | 504 Gateway Timeout |

**Idempotency retry logic in backend:**
- 409 (in-flight): Retry after exponential backoff (max 3 retries, 1s base)
- 503/504 (shop-api down): Fail immediately; client sees 503; client is responsible for retry

---

## Preventing Silent Dual-Writes

### Guarantee 1: Single Write Path
After Phase 2, `POST /shop/purchase` ALWAYS delegates to shop-api. The legacy backend logic is gated behind a feature flag and never both codepaths execute for the same request.

### Guarantee 2: No Parallel Writes
- Backend HTTP request → proxy service → single HTTP call to shop-api
- No background jobs or async write
