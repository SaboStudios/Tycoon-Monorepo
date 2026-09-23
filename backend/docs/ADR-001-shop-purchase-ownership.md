# ADR-001: Shop Purchase Write Path Ownership — Backend vs shop-api

**Status:** Decided  
**Date:** 2026-08-26  
**Author:** Backend Team  
**Issue:** #1432  
**Related:** #1710 (Ledger reconciliation admin tools for shop and pots)

## Problem Statement

The codebase currently has two independent purchase write paths:

1. **Backend** (`backend/src/modules/shop/shop.controller.ts` → `POST /shop/purchase`)
   - Handles HTTP requests, idempotency, inventory updates
   - Uses `IdempotencyInterceptor` + Redis for exactly-once semantics
   - Stores purchases directly in the backend database

2. **shop-api** (`shop-api/src/purchases/purchases.controller.ts` → `POST /purchases`)
   - Duplicate purchase creation, idempotency implementation
   - Uses `IdempotencyService` + PostgreSQL for key management
   - Stores purchases in a separate shop-api database

**Consequences of dual-write paths:**
- Purchase logic is implemented twice (maintenance burden)
- No single source of truth for the business logic
- Risk of divergence: bugfixes in one path don't reach the other
- Silent dual-writes are possible if both paths are called
- Schema drift between backend and shop-api databases
- Complex audit trail when purchases touch both systems

**Example failure mode:**  
If a client sends a purchase request to both endpoints with the same idempotency key, they could get two distinct purchase IDs back, causing an inventory mismatch and audit confusion.

---

## Decision

**Adopt the Proxy Pattern: Backend proxies all purchase writes to shop-api.**

### Rationale

| Option | Pros | Cons | Risk |
|--------|------|------|------|
| **Proxy** | Single write path; shop-api is the source of truth; no merge needed; gradual cutover | Extra network hop; service dependency; requires client migration | Mitigated by explicit contract + canary testing |
| **Merge** | One codebase; no network dependency; simpler deployment | Disruptive; requires schema consolidation; larger refactor | Breaks existing shop-api clients; slower rollout |
| **Split** | Services stay independent | No single source of truth; dual-write risk; hard to audit | Unacceptable — violates the constraint |

**Chosen: Proxy.**

This approach:
1. **Eliminates dual-writes** — all writes flow through shop-api
2. **Preserves existing shop-api clients** — they continue calling `POST /shop-api/purchases`
3. **Unifies backend clients** — they call `POST /shop/purchase`, which proxies internally
4. **Enables gradual migration** — canary testing + monitoring before full cutover
5. **Single source of truth** — purchase records, idempotency state, and metadata live in shop-api

---

## Authoritative Write Path (issue #1710)

For ledger reconciliation of **shop purchases and pots**, the authoritative write path is:

| Concern | Authoritative system | Notes |
|---|---|---|
| Purchase creation / money movement | **shop-api** (`POST /purchases`) | Only writer of purchase + ledger rows |
| Pot contributions / payouts | **shop-api** (`POST /pots/:id/contributions`, `POST /pots/:id/payouts`) | Same idempotency + ledger guarantees |
| Inventory decrement | **shop-api** (transactional, row-locked) | Backend never mutates inventory directly |
| Idempotency records | **shop-api** (`IdempotencyService`, PostgreSQL) | Backend Redis cache is a read-through only |
| Admin reconciliation reads | **backend** read model (`GET /admin/ledger/reconciliation`) | Proxy/read model; never writes |
| Admin catalog mutations | **backend** (`/admin/shop/*`) | Audited; forwarded to shop-api for price/SKU SoT |

**Backend proxy / read models:**
- `POST /shop/purchase` → proxy to shop-api `POST /purchases` (write path).
- `GET /admin/ledger/reconciliation` → backend read model that joins shop-api purchase ledger with pot ledger snapshots. Read-only; safe to serve from a replica.
- `GET /admin/ledger/reconciliation/:id` → single-entry drill-down; must include `requestId` for cross-service tracing.

**Fail-closed rule:** if shop-api is unreachable, times out (>5s), or returns 5xx, the backend MUST return `503 Service Unavailable` and MUST NOT fall back to local writes. Reconciliation reads may serve stale data with an explicit `stale: true` marker, but writes never degrade.

## Feature Flags (Issue #1806)

The proxy cutover and the Stellar UI gate are controlled by the authoritative,
server-side feature flag service (`backend/src/modules/feature-flags`). Flags are
**deny-by-default**: an unknown flag, a missing flag, or a flag store outage
(Postgres/Redis) resolves to `disabled`. Clients must never be trusted to decide
whether a surface is enabled.

| Flag | Default | Gates |
|------|---------|-------|
| `SHOP_PURCHASES_BACKEND_PROXY_ENABLED` | `false` | Backend `POST /shop/purchase` proxies writes to shop-api instead of legacy local logic |
| `SHOP_PROXY_GAMES_WS_ENABLED` | `false` | Shop proxy games WebSocket surface (deny-by-default; disabled until explicitly enabled) |
| `STELLAR_UI_ENABLED` | `false` | Stellar UI gate. Per ADR-003, NEAR remains the only supported chain UI until this flag is explicitly enabled |

### Read path for the frontend

The frontend must not infer Stellar availability from client state. It reads the
evaluated flags from the backend read endpoint (`GET /feature-flags`), which
returns the server-evaluated values. If the flag service cannot reach its
dependencies, the endpoint returns the deny-by-default values (all `false`) so
the Stellar UI stays gated and the games WS surface stays closed.

### Fail-closed behavior

- Flag evaluation errors (Postgres/Redis outage, timeout) → flag resolves to `false`.
- The read endpoint never throws a 5xx that would let a client fall back to
  optimistic defaults; it returns the disabled snapshot.
- Enabling a flag is an explicit, audited operator action; there is no
  client-supplied override.

---

## Implementation Plan

### Phase 1: Service Contract (Week 1)
1. **Document the contract** for shop-api's `POST /purchases`:
   - Required headers: `Idempotency-Key` (UUID, max 255 chars)
   - Request body: `{ userId, itemId, amount, currency, metadata? }`
   - Success response: 201 with `{ id, userId, itemId, amount, createdAt, ... }`
   - Replay response: 201 with `x-idempotency-replayed: true` header
   - Concurrent duplicate: 409 with message "Request is still being processed"

2. **

---

## Implementation Plan

### Phase 1: Service Contract (Week 1)
1. **Document the contract** for shop-api's `POST /purchases`:
   - Required headers: `Idempotency-Key` (UUID, max 255 chars)
   - Request body: `{ userId, itemId, amount, currency, metadata? }`
   - Success response: 201 with `{ id, userId, itemId, amount, createdAt, ... }`
   - Replay response: 201 with `x-idempotency-replayed: true` header
   - Concurrent duplicate: 409 with message "Request is still being processed"

2. **Auth & schema alignment:**
   - shop-api must accept backend JWT tokens (or use internal service-to-service auth)
   - shop-api's `userId` ↔ backend's user context mapping
   - shop-api's `itemId` ↔ backend's `shop_item_id` naming consistency
   - shop-api's schema must include all fields needed by backend (price, currency, metadata)

### Phase 2: Proxy Implementation (Week 2)
1. **Create a purchase proxy in backend** (`backend/src/modules/shop/shop-api-proxy.service.ts`):
   ```typescript
   async proxyCreatePurchase(
     userId: number,
     createPurchaseDto: CreatePurchaseDto,
     idempotencyKey: string,
   ): Promise<Purchase> {
     const response = await this.httpClient.post(
       `${SHOP_API_URL}/purchases`,
       {
         userId,
         itemId: createPurchaseDto.shop_item_id,
         amount: createPurchaseDto.final_price,
         currency: createPurchaseDto.currency,
         metadata: { ... },
       },
       {
         headers: { 'Idempotency-Key': idempotencyKey },
       },
     );
     return this.mapShopApiResponse(response);
   }
   ```

2. **Update `POST /shop/purchase`:**
   - Maintain the same external contract (no client changes needed)
   - Extract idempotency key from request header
   - Delegate to proxy service instead of local `PurchaseService`
   - Handle shop-api errors and map to HTTP responses

3. **Feature flag** (env var: `SHOP_PURCHASES_BACKEND_PROXY_ENABLED`):
   - `true` → use proxy (shop-api as source of truth)
   - `false` → use legacy backend logic (for rollback)

### Phase 3: Testing & Canary (Week 3)
1. **Unit tests** for the proxy service (mock shop-api HTTP calls)
2. **Integration tests** calling `POST /shop/purchase` end-to-end
3. **Canary traffic**:
   - 5% of production requests → proxy
   - 95% of production requests → legacy backend logic
   - Monitor error rates, latency, idempotency key collisions
4. **Full cutover** once metrics are stable for 1 week

### Phase 4: Cleanup (Week 4)
1. Remove legacy `PurchaseService.createPurchase()` logic
2. Deprecate the `IdempotencyInterceptor` in backend (shop-api owns it now)
3. Update `SHOP_PURCHASES_RUNBOOK.md` to reference shop-api as source of truth
4. Archive backend's purchase tables (or drop after 30-day retention policy)

---

## Auth & Service-to-Service Communication

### Option A: Backend → shop-api via JWT
- Backend extracts user's JWT from the incoming request
- Backend forwards JWT to shop-api in proxy call
- shop-api validates JWT using the same secret
- ✅ Simple; reuses existing JWT infrastructure
- ⚠️ Exposes user tokens to shop-api (mitigated by mTLS)

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
