# Shop Purchases Runbook

Operational guide for the shop-api purchase path (the source of truth for
money, inventory, and admin catalog mutations) and the public Shop catalog
read path.

## Scope

- **shop-api** is the authoritative write path for purchases and admin
  catalog mutations (create/update/delete of SKUs).
- **backend** may proxy public catalog reads; it must never be the source of
  truth for price, inventory, or admin state.
- **frontend** renders catalog data only; it must not trust client-supplied
  price or inventory.

## Health vs readiness probes

Both **backend** and **shop-api** expose two distinct probes. They are not
interchangeable: liveness answers "is the process alive?" and readiness
answers "can this instance safely serve traffic right now?".

### Liveness (health)

- Endpoint: `GET /health` (backend and shop-api).
- Semantics: process liveness only. It MUST NOT touch Postgres, Redis,
  shop-api, or RPC. A dependency outage must never cause a liveness failure,
  otherwise orchestrators will restart healthy pods and amplify the outage.
- Response: `200` with a minimal body (e.g. `{ "status": "ok" }`). No
  dependency details, no secrets, no PII.
- Used by: container liveness probes and restart policies.

### Readiness (ready)

- Endpoint: `GET /ready` (backend and shop-api).
- Semantics: readiness reflects dependency availability. It checks the
  dependencies required to serve the write path — at minimum Postgres and
  Redis — and reports `503` when any required dependency is unavailable.
- Fail-closed: when a required dependency is down, readiness MUST report
  not-ready so the instance is removed from load-balancer rotation and
  writes are not routed to it. This is the mechanism that enforces the
  "writes fail closed" guarantee for the purchase path.
- Response: `200` when all required dependencies are reachable, `503`
  otherwise. The body reports per-dependency status using stable, non-secret
  labels (e.g. `postgres`, `redis`) and never includes connection strings,
  credentials, tokens, or PII.
- Used by: load-balancer / service readiness gates and rollout gating.

### Operator expectations

- A pod that is alive but not ready is expected during dependency outages;
  do not restart it — fix the dependency. Restarting a not-ready pod does
  not help and can worsen the incident.
- A pod that is not alive (liveness failing) is a process-level fault and is
  restarted by the orchestrator.
- During a Postgres or Redis outage, expect readiness to fail closed for
  both backend and shop-api; purchase writes will be rejected rather than
  served from a degraded instance.
- Probe endpoints are unauthenticated by design but MUST NOT leak secrets or
  PII in responses or telemetry labels; they are rate-limited like other
  external entrypoints.

### Observability for probes

- Probe results are emitted using the existing metrics conventions: a
  readiness gauge labeled by dependency name and outcome only (no PII, no
  tokens, no connection details).
- Liveness checks emit no dependency labels (there are none to report).
- Probe failures are logged with `requestId` where available and mapped per
  `docs/API_ERROR_RESPONSE_STANDARDS.md`; they never include secrets.

## Public catalog read caching

Public Shop catalog reads are served from a cache layer in front of the
authoritative shop-api read path.

### Cache key scheme

- Per-SKU keys: `shop:catalog:sku:{sku}`
- Catalog listing key: `shop:catalog:list:{page}:{pageSize}`
- Catalog version key: `shop:catalog:version` (monotonic counter bumped on
  every successful admin mutation)

### TTL

- Per-SKU entries: `SHOP_CATALOG_SKU_TTL_SECONDS` (default 300s).
- Listing entries: `SHOP_CATALOG_LIST_TTL_SECONDS` (default 60s).
- TTL is a safety net only; correctness relies on explicit invalidation on
  admin edit (see below).

### Read path

1. Compute the cache key for the requested SKU or listing.
2. On hit, return the cached payload.
3. On miss, read from shop-api (authoritative), populate the cache, and
   return the fresh payload.
4. Cache is never authoritative: price, inventory, and admin state always
   come from shop-api on miss, and any cached value is treated as a hint.

## Invalidation on admin edit

Every successful admin catalog mutation (create/update/delete) MUST
invalidate or refresh the affected cache entries before the mutation is
reported as successful.

1. Persist the mutation in shop-api (authoritative write).
2. Bump `shop:catalog:version`.
3. Delete `shop:catalog:sku:{sku}` for the affected SKU.
4. Delete all `shop:catalog:list:*` entries (or refresh them from the
   authoritative read path).
5. Only after steps 2–4 succeed, return success to the admin caller.

### Concurrency (edit during read)

- Invalidation is version-guarded: a reader that started before the bump
  must not repopulate the cache with pre-edit data. Readers include the
  observed `shop:catalog:version` in the value they write; a write whose
  version is older than the current version is discarded.
- Admin edits and reads may interleave; the post-edit read must observe the
  new version and fall through to shop-api.

### Fail-closed on admin writes

- If the cache/dependency (Redis) is unavailable during an admin mutation,
  the mutation MUST fail closed: do not report success, do not silently drop
  invalidation. Surface a 5xx mapped per
  `docs/API_ERROR_RESPONSE_STANDARDS.md` and alert operators.
- Public reads may degrade to the authoritative shop-api read path when the
  cache is unavailable; they must not serve stale data as if it were fresh.

## Purchase path (authoritative writes)

- Idempotency-Key is required; the body hash is stored with the response.
  Replays return the stored response; a conflicting payload returns 409.
- Inventory adjustments are atomic (constraint or reservation TTL) so
  concurrent buys for the same SKU cannot oversell; inventory never goes
  negative.
- `requestId` is propagated end-to-end; errors map to
  `docs/API_ERROR_RESPONSE_STANDARDS.md`; RED metrics are emitted for
  purchases.
- Writes fail closed when Postgres, Redis, shop-api, or RPC dependencies are
  unavailable. Readiness probes (see above) are what remove a degraded
  instance from rotation so these writes are not attempted against it.

### DTO validation (purchase request)

- `sku`: required, non-empty string, bounded length; must match an existing
  catalog SKU (no enumeration leakage — unknown SKUs return the same error
  shape as invalid input).
- `quantity`: required integer, `>= 1`, bounded by a per-request max
  (`SHOP_PURCHASE_MAX_QUANTITY`, default 100).
- `unitMinorUnits` / price fields: server-derived from the authoritative
  catalog; any client-supplied price is rejected as an unknown field.
- Unknown fields are rejected (`forbidNonWhitelisted`); oversized payloads
  are rejected before parsing business logic.

### Idempotency semantics

- Key: `Idempotency-Key` header (required). Stored alongside a hash of the
  canonical request body.
- Replay with the same key and identical body hash: return the stored
  response (same status, same body) without re-executing the purchase.
- Replay with the same key and a different body hash: return `409 Conflict`
  mapped per `docs/API_ERROR_RESPONSE_STANDARDS.md`.
- TTL: idempotency records expire after `SHOP_IDEMPOTENCY_TTL_SECONDS`
  (default 86400s). After expiry the key no longer replays and a new key is
  required; clients must not reuse keys across logical purchases.

### Atomic inventory

- Inventory is decremented in the same transaction as the purchase record
  using a conditional update (`WHERE inventory >= quantity`) or a row lock,
  so concurrent checkouts of the same SKU cannot oversell.
- If the conditional update affects zero rows, the purchase fails with a
  conflict/out-of-stock error and no inventory change is committed.
- Reservation TTL (if used) must expire reservations back to available
  inventory; expired reservations 

/* … truncated 2656 chars — edit only what you need near the top … */
