# Quick Start Guide

## Installation & Setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env
```

3. Start the development server:

```bash
npm run dev
```

The server will start on http://localhost:3000

## Testing the API

### Option 1: Using Postman

1. Import `postman_collection.json` into Postman
2. Run "Login as Admin" request (token will be saved automatically)
3. Test other endpoints

### Option 2: Using curl

1. Login to get token:

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

2. Save the token from response and use it:

```bash
TOKEN="your-token-here"

# Create an item
curl -X POST http://localhost:3000/api/shop \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Widget",
    "description": "High-quality widget",
    "price": 99.99,
    "isActive": true
  }'

# Get all items
curl http://localhost:3000/api/shop

# Update price
curl -X PATCH http://localhost:3000/api/shop/1/price \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price": 79.99}'

# Deactivate item
curl -X PATCH http://localhost:3000/api/shop/1/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"isActive": false}'

# Bulk update
curl -X POST http://localhost:3000/api/shop/bulk/update \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      {"id": "1", "data": {"price": 99.99}},
      {"id": "2", "data": {"isActive": false}}
    ]
  }'
```

## Purchases: Idempotency & Authoritative Write Path

### Authoritative write path

`shop-api` is the single source of truth for purchases and inventory. The backend
acts only as a proxy/read model during the proxy canary dual-read window: it may
forward purchase requests to `shop-api` and serve cached reads, but it must never
mutate inventory or prices itself. All money, inventory, and purchase mutations
are owned by `shop-api` (see `backend/docs/ADR-001-shop-purchase-ownership.md`).

### Idempotency-Key contract

Every purchase write MUST include an `Idempotency-Key` header. The server hashes
the request body and stores the response keyed by `Idempotency-Key` in Redis.

- First request with a key: processed, response stored with the body hash.
- Replay with the same key and identical body hash: the stored response is
  returned verbatim (no second purchase, no inventory change).
- Replay with the same key but a different body hash: rejected with `409 Conflict`.
- Keys expire after the configured idempotency TTL; after expiry a reused key is
  treated as a new request, so clients must not reuse keys across distinct intents.

```bash
# Purchase with idempotency (safe to retry on timeout/reconnect)
curl -X POST http://localhost:3000/api/shop/purchases \
  -H "Authorization: Bearer $TOKEN" \
  -H "Idempotency-Key: 8f2c1e6a-4b7d-4f0a-9c3e-2d1b5a7e9f01" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "premium-widget",
    "quantity": 1,
    "unitPriceMinor": 9999
  }'
```

### DTO validation

Purchase DTOs validate `sku` (non-empty string), `quantity` (positive integer),
and `unitPriceMinor` (non-negative integer minor units). Unknown fields are
rejected per policy, and the client-supplied price is never trusted as the
source of truth — `shop-api` re-resolves the authoritative price.

### Inventory atomicity

Inventory is adjusted atomically in `shop-api` (DB constraint or reservation
with TTL) so concurrent buys for the same SKU cannot oversell. Inventory must
never go negative; on dependency outage (Postgres/Redis/shop-api/RPC) writes
fail closed.

### Error mapping & observability

Errors follow `docs/API_ERROR_RESPONSE_STANDARDS.md`, `requestId` is propagated
end-to-end, and RED metrics are emitted for the purchase path. See
`backend/docs/SW-BE-033-redis-idempotency-replay-tests.md` for replay tests and
`SHOP_PURCHASES_RUNBOOK.md` for operator procedures.

### Cleanup indexes migration

`shop-api/src/migrations/` owns the purchases cleanup indexes migration. It adds
the indexes that keep idempotency replay lookups and inventory reservation
sweeps fast, and it is verified as part of the purchase path:

- `purchases(idempotency_key)` — unique, backs replay lookup and the 409
  payload-conflict check.
- `purchases(sku, created_at)` — supports per-SKU concurrency and oversell
  audits.
- `inventory_reservations(expires_at)` — drives TTL cleanup of stale
  reservations so inventory is released deterministically.

Run the migration before enabling purchase writes and confirm it is applied
(`migration verified`) in the target environment. A partial or unapplied
migration must fail closed: purchase writes stay disabled until the indexes are
present, since replay and oversell guarantees depend on them. Rollback notes:
the migration is additive (index-only) and can be reverted by dropping the
indexes without data loss.

## Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in CI mode
npm run test:ci
```

## Building for Production

```bash
# Build TypeScript to JavaScript
npm run build

# Start production server
npm start
```

## Key Features Implemented

✅ Admin authentication with JWT
✅ Create shop items
✅ Update item details
✅ Update prices specifically
✅ Activate/deactivate items
✅ Upload images (up to 5 per request)
✅ Bulk update operations
✅ Delete items
✅ Admin-only access control
✅ Comprehensive test coverage (87%+)
✅ CI/CD ready with GitHub Actions

## Default Credentials

- Username: `admin`
- Password: `admin123`

⚠️ Change these in production!

## Project Structure

```
src/
├── __tests__/          # Test files
│   ├── auth.test.ts
│   ├── shop.test.ts
│   ├── shopService.test.ts
│   ├── middleware.test.ts
│   └── upload.test.ts
├── middleware/         # Auth and upload middleware
│   ├── auth.ts
│   └── upload.ts
├── routes/            # API routes
│   ├── authRoutes.ts
│   └── shopRoutes.ts
├── services/          # Business logic
│   └── shopService.ts
├── types/             # TypeScript types
│   └── index.ts
├── app.ts             # Express app setup
└── index.ts           # Server entry point
```

## Next Steps

For production deployment:

1. Replace in-memory storage with a database (PostgreSQL, MongoDB)
2. Add rate limiting
3. Implement proper logging
4. Use cloud storage for images (S3, Cloudinary)
5. Add pagination
6. Set up monitoring and error tracking
7. Configure HTTPS
8. Update JWT secret and admin credentials
