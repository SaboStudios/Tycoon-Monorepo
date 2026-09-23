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
  unavailable.

## Edge cases

- Concurrent duplicate requests / reconnect retries: handled by
  Idempotency-Key + body hash.
- Idempotency TTL expiry reuse: after TTL, a new key is required; the old
  key no longer replays.
- shop-api timeout vs client retry: client retries with the same
  Idempotency-Key; server returns the stored response on replay.
- Catalog edit during purchase: purchase reads authoritative price/inventory
  from shop-api; the catalog cache is invalidated on edit and never trusted
  for money or inventory.

## Security

- Server remains source of truth for money, dice, inventory, and admin
  mutations.
- No secrets in repo/logs; redact tokens and avoid PII in telemetry labels.
- Rate-limit and authorize every external entrypoint touched by this work.
- Deny-by-default for new admin/WS/action surfaces.
- API-key only for service calls; no client-trusted price.
- Admin catalog mutations are audited.

## Rollback

- Disable the catalog cache flag to fall back to direct shop-api reads.
- Invalidation remains required on admin edits regardless of cache flag.

## References

- `backend/docs/REDIS_CACHE_RUNBOOK.md`
- `backend/docs/API_ERROR_RESPONSE_STANDARDS.md`
- ADR-001 / ADR-003 notes for operators.
