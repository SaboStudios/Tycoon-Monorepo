# ADR-001: Shop Purchase Write Path Ownership — Backend vs shop-api

**Status:** Decided  
**Date:** 2026-08-26  
**Author:** Backend Team  
**Issue:** #1432

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
- No background jobs or async writes that could race
- Audit trail shows exactly one write

### Guarantee 3: Idempotency Contract Enforced
- Backend REQUIRES `Idempotency-Key` header (guards/validators enforce this)
- shop-api REQUIRES the header (IdempotencyKeyGuard)
- Duplicate headers → shop-api returns cached response, not a new record

### Monitoring
- Alert if backend creates a purchase without forwarding to shop-api (should never happen post-Phase 2)
- Alert if same idempotency key returns different `purchaseId` values (indicates dual-write bug)
- Log all proxy calls; cross-check with shop-api audit logs

---

## Backward Compatibility

### For Clients Calling `POST /shop/purchase` (most users)
- ✅ No changes required
- The endpoint continues to work identically
- Idempotency-Key contract remains the same
- Backend handles the proxy internally

### For Clients Calling `POST /shop-api/purchases` (if any exist)
- ✅ Continue to work
- shop-api remains the authoritative implementation
- No forced migration; can coexist during transition

---

## Rollback Plan

If the proxy implementation causes issues:

1. **Immediate:** Set `SHOP_PURCHASES_BACKEND_PROXY_ENABLED=false` in production
   - Requests fall back to legacy backend logic
   - Existing purchase records in shop-api are preserved
   - Downtime: ~10 seconds (rolling restart of backend pods)

2. **Investigation window:** Monitor error rates, latency, audit mismatches

3. **Gradual recovery:**
   - Investigate root cause (network, schema mismatch, auth issue, etc.)
   - Fix in a new version
   - Re-enable proxy with canary traffic (5%) before full cutover

4. **Worst case:** Revert the feature branch entirely; dual-write path continues until root cause is fixed

---

## Success Criteria

✅ Proxy implementation merged and deployed to staging  
✅ `POST /shop/purchase` returns identical responses as before (except maybe headers)  
✅ Idempotency-Key header required and enforced in both paths  
✅ All purchase records created in shop-api database only  
✅ Audit trail shows shop-api as source of truth for all purchases  
✅ 0 instances of dual-writes detected in production (monitored via alerts)  
✅ Latency (backend → shop-api) < 100ms p50, < 500ms p99  
✅ canary test passes: 5% → 25% → 100% traffic migration succeeds  

---

## Related Issues & Links

- Issue #1431 — Documents Idempotency-Key contract in Swagger & runbook
- `SHOP_PURCHASES_RUNBOOK.md` — Operational procedures (updated post-decision)
- `backend/src/modules/shop/shop-api-proxy.service.ts` — Implementation TBD
- `backend/docs/ADMIN_ROUTES_MATRIX.md` — Admin shop routes (separate from purchases)

---

## Future Considerations

1. **shop-api consolidation:** Once proxy is stable, consider merging shop-api schema into backend or vice versa (out of scope for this ADR)
2. **Async purchase processing:** If purchase processing becomes expensive, introduce a job queue (currently synchronous)
3. **Multi-datacenter replication:** If shop-api grows, add read replicas and cross-DC failover
