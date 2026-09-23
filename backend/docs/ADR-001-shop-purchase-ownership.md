# ADR-001: Shop Purchase Ownership (Authoritative Write Path)

- Status: Accepted
- Date: 2024-01-01
- Related: ADR-003 (NEAR wallet is the only supported chain UI), `docs/API_ERROR_RESPONSE_STANDARDS.md`, `docs/SHOP_PURCHASES_RUNBOOK.md`

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

## Consequences

- A single writer (`shop-api`) makes inventory and idempotency reasoning tractable.
- `backend` proxy code stays thin and testable; contract tests assert envelope and `requestId` propagation.
- Operators have one runbook (`docs/SHOP_PURCHASES_RUNBOOK.md`) for purchase incidents.
- Any future service that needs to mutate purchases must go through `shop-api` or supersede this ADR.

## Out of scope

- Mainnet irreversible deploys without a readiness issue.
- Unrelated package refactors.
- Stellar chain UI (gated by ADR-003; NEAR remains the only supported chain UI).
