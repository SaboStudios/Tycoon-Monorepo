# ADR-001: Shop Purchase Ownership (Authoritative Write Path)

- Status: Accepted
- Date: 2024-01-01
- Related: ADR-003 (NEAR wallet is the only supported chain UI), ADR-004 (Session httpOnly cookies + CSRF), `docs/API_ERROR_RESPONSE_STANDARDS.md`, `docs/SHOP_PURCHASES_RUNBOOK.md`

**Status:** Decided  
**Date:** 2026-08-26  
**Author:** Backend Team  
**Issue:** #1432  
**Related:** #1710 (Ledger reconciliation admin tools for shop and pots), #1727 (Shop grid a11y strictness CLS telemetry purchase wire), #1729 (Session httpOnly cookies + CSRF across api client), #1789 (Inventory reservation atomic decrement anti-oversell)

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
   - Replay with the same key and same body hash returns the stored response.
   - Replay with the same key and a different body hash returns `409` with code `IDEMPOTENCY_CONFLICT`.
   - Keys expire per the TTL documented in `docs/SHOP_PURCHASES_RUNBOOK.md`; after expiry a new request is treated as a fresh purchase.

5. **Inventory integrity.** Inventory adjustments are atomic (constraint or reservation with TTL) so concurrent purchases of the same SKU cannot oversell. Inventory must never go negative.

6. **Fail-closed on dependency outage.** If Postgres, Redis, `shop-api`, or the RPC dependency is unavailable, purchase writes return an error envelope with code `DEPENDENCY_UNAVAILABLE` and HTTP `503`. Reads may degrade, writes must not.

7. **Strict DTO validation.** Purchase request DTOs validate `sku` (non-empty string, known catalog SKU), `quantity` (positive integer within bounds), and `minorUnits` (non-negative integer). Unknown fields are rejected (`forbidNonWhitelisted`) per policy; client-supplied price is never trusted.

8. **Observability.** Purchase writes propagate `requestId` end-to-end and emit RED metrics (`shop_purchase_requests_total`, `shop_purchase_errors_total`, `shop_purchase_duration_seconds`). Metric labels must not contain tokens or PII.

9. **Session auth for purchase writes (issue #1729).** Purchase mutations are cookie-authenticated per ADR-004; the api client MUST NOT read or attach JS-readable access tokens.
   - Session cookies are `httpOnly`, `Secure`, and `SameSite=Lax` (or `Strict` for admin surfaces). Access tokens are never exposed to JS.
   - Cookie-authenticated mutations require a CSRF defense: a double-submit CSRF token (or equivalent origin-checked token) validated server-side before any purchase write. Missing/invalid CSRF token returns `403` with code `CSRF_INVALID` and no state change.
   - The `backend` proxy forwards the session cookie and CSRF token unchanged to `shop-api`; it never mints or caches a bearer token on the client's behalf.
   - `returnTo`/redirect parameters on auth and purchase flows are validated against an allowlist; non-allowlisted targets are rejected to prevent open redirects.
   - Refresh/rotation follows `AUTH_JWT_RUNBOOK` and `TOKEN_REFRESH_SECURITY_GUIDE`; refresh-token reuse revokes the token family. Parallel refreshes are serialized so a single rotation wins.

10. **Atomic inventory decrement / reservation (issue #1789).** The anti-oversell guarantee is enforced in the datastore, not in application-level read-then-write logic:
    - **Single-statement conditional decrement.** `shop-api` decrements inventory with a guarded update, e.g. `UPDATE inventory SET available = available - :qty WHERE sku = :sku AND available >= :qty`. A row count of `0` means insufficient stock and the purchase is rejected with `409` and code `INSUFFICIENT_INVENTORY`; no partial write occurs.
    - **Reservation with TTL.** When a purchase spans multiple steps (payment/ledger), `shop-api` first inserts a reservation row `(sku, quantity, idempotencyKey, expiresAt)` inside the same transaction as the decrement. Reservations expire after the TTL documented in `docs/SHOP_PURCHASES_RUNBOOK.md`; an expired reservation is released by a sweeper that re-increments `available` exactly once (guarded by the reservation's terminal state so it cannot double-release).
    - **Constraint backstop.** A `CHECK (available >= 0)` constraint (or equivalent) is the last line of defense: any code path that would drive inventory negative fails the transaction rather than persisting a negative count.
    - **Idempotency interaction.** The decrement/reservation is committed in the same transaction as the idempotency record, so a replayed `Idempotency-Key` returns the stored response without decrementing again, and a `409 IDEMPOTENCY_CONFLICT` never mutates inventory.
    - **Concurrency.** Two concurrent buys of the same SKU serialize on the inventory row (row lock / conditional update); at most one succeeds when stock is `1`. This is asserted by the `shop-api` purchases e2e concurrency test.

## Consequences

- A single writer (`shop-api`) makes inventory and idempotency reasoning tractable.
- `backend` proxy code stays thin and testable; contract tests assert envelope and `requestId` propagation.
- Operators have one runbook (`docs/SHOP_PURCHASES_RUNBOOK.md`) for purchase incidents.
- Cookie-based sessions remove JS-readable tokens from the purchase path, shrinking XSS blast radius; CSRF tokens are required for every cookie-authenticated mutation.
- Datastore-enforced decrement/reservation makes oversell impossible even under concurrent retries, and the `available >= 0` constraint turns any future regression into a failed transaction instead of a negative count.
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

- Inventory decrements are performed as a single guarded statement (`available >= :qty`) so the check and the write are atomic; a zero-row result is a `409 INSUFFICIENT_INVENTORY`.
- Multi-step purchases hold a reservation row with a TTL; the sweeper releases expired reservations exactly once.
- A `CHECK (available >= 0)` constraint backstops every write path.
- The decrement/reservation commits in the same transaction as the idempotency record, so replays and `409 IDEMPOTENCY_CONFLICT` responses never mutate inventory.
- See decision item 10 for the full anti-oversell contract (issue #1789).
