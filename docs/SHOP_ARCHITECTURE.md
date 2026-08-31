# Shop Architecture

This document describes the two purchase systems in the Tycoon monorepo, their
boundaries, and which UI layer calls which. Read this before touching either the
backend `shop` module or the `shop-api` microservice.

See [ADR-001](../backend/docs/ADR-001-shop-purchase-ownership.md) for the
full decision record and migration plan.

---

## System boundary diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser / Frontend (Next.js)                                       │
│                                                                     │
│  ┌─────────────────────┐     ┌────────────────────────────────┐    │
│  │  /shop page         │     │  Game UI (ShopGrid,            │    │
│  │  (ShopGrid.tsx)     │     │   PurchaseModal.tsx)           │    │
│  └────────┬────────────┘     └──────────────┬─────────────────┘    │
│           │                                 │                      │
│           │  POST /api/v1/shop/purchase      │                      │
│           │  + Idempotency-Key header        │                      │
└───────────┼─────────────────────────────────┼──────────────────────┘
            │                                 │
            ▼                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Backend (NestJS — port 3000)                                       │
│                                                                     │
│  src/modules/shop/                                                  │
│  ├── shop.controller.ts   ← POST /api/v1/shop/purchase             │
│  ├── shop.service.ts      ← item catalog, inventory reads           │
│  ├── purchase.service.ts  ← legacy write path (feature-flagged)    │
│  └── inventory.service.ts ← inventory cache + invalidation         │
│                                                                     │
│  Cross-cutting:                                                     │
│  ├── IdempotencyInterceptor (Redis)  — exactly-once semantics      │
│  ├── JwtAuthGuard                    — validates Bearer token       │
│  └── AuditTrailInterceptor           — logs all writes             │
│                                                                     │
│  Feature flag: SHOP_PURCHASES_BACKEND_PROXY_ENABLED                │
│  ┌─────────────────────────────────────────────────────┐           │
│  │  false (default): writes handled locally            │           │
│  │  true:  all writes proxied → shop-api               │           │
│  └──────────────────────┬──────────────────────────────┘           │
│                         │  HTTP POST /purchases                    │
│                         │  + Idempotency-Key (forwarded)           │
└─────────────────────────┼───────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────┐
│  shop-api microservice (NestJS — separate process & DB)             │
│                                                                     │
│  src/purchases/                                                     │
│  ├── purchases.controller.ts   ← POST /purchases                   │
│  ├── purchases.service.ts      ← authoritative write + QueryRunner │
│  └── entities/purchase.entity.ts                                   │
│                                                                     │
│  src/idempotency/                                                   │
│  ├── idempotency.service.ts    ← claim / complete / fail           │
│  └── entities/idempotency-record.entity.ts                         │
│                                                                     │
│  src/common/guards/                                                 │
│  └── idempotency-key.guard.ts  ← validates header, returns 400    │
│                                   if missing                        │
│                                                                     │
│  PostgreSQL database (own schema — not shared with backend)        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Responsibilities

### Backend `src/modules/shop/`

- **Item catalog** — serves `GET /api/v1/shop/items` from the backend database
- **Inventory reads** — `GET /api/v1/shop/inventory/:userId`, cached in Redis
- **Purchase write** — `POST /api/v1/shop/purchase`
  - Currently writes to the **backend database** (legacy path, feature-flagged)
  - Will proxy to shop-api once `SHOP_PURCHASES_BACKEND_PROXY_ENABLED=true`
- **Admin shop** — `admin-shop.controller.ts` handles item management (separate from purchases)
- **Cache invalidation** — invalidates `shop:inventory:<userId>` on purchase

### `shop-api` microservice

- **Authoritative purchase writer** — the single source of truth for purchase
  records, idempotency state, and financial metadata
- **Idempotency** — `claimKey` → process → `markCompleted` / `markFailed`
  state machine backed by PostgreSQL
- **Own database** — schema: `purchases` + `idempotency_records` (not shared)
- **Direct callers** — any client that calls `POST /purchases` directly (e.g.
  internal tools, future mobile clients)

---

## Authentication

| Path | Auth mechanism |
|------|---------------|
| `POST /api/v1/shop/purchase` (backend) | User JWT (`Authorization: Bearer <accessToken>`) validated by `JwtAuthGuard` |
| `POST /purchases` (shop-api, from browser) | Same JWT — shop-api validates using the shared `JWT_SECRET` |
| `POST /purchases` (shop-api, from backend proxy) | JWT passthrough (Option A per ADR-001) — backend forwards user token; shop-api validates it. Migrate to service-to-service token (Option B) once mTLS is in place |

---

## Idempotency keys

Both systems require `Idempotency-Key` on purchase writes.

| Layer | Header | Enforced by |
|-------|--------|-------------|
| Backend | `Idempotency-Key` | `IdempotencyInterceptor` (Redis, 24 h TTL) |
| shop-api | `Idempotency-Key` | `IdempotencyKeyGuard` → `IdempotencyService` (PostgreSQL) |

When the proxy is active, the backend **forwards the same key** to shop-api.
shop-api becomes the deduplication authority; the backend's Redis record is
not created (no double-bookkeeping).

**Key format**: any unique string ≤ 255 chars. Prefer UUID v4.

---

## Which UI calls which

| User action | Endpoint | Owner |
|-------------|----------|-------|
| Browse shop items | `GET /api/v1/shop/items` | Backend |
| View inventory | `GET /api/v1/shop/inventory/:userId` | Backend |
| Purchase item (ShopGrid / PurchaseModal) | `POST /api/v1/shop/purchase` | Backend (proxies to shop-api when flag is on) |
| Internal / ops tooling purchase | `POST /purchases` | shop-api directly |

The frontend **never calls shop-api directly**. All frontend traffic goes
through the backend. This gives the backend a single point to enforce auth,
rate limiting, and audit logging.

---

## Dual-write risk

There is currently a potential dual-write path: if a client somehow calls both
`POST /api/v1/shop/purchase` (backend) and `POST /purchases` (shop-api) with
different idempotency keys, they get two distinct purchase IDs.

Guardrails in place:

1. **Single public-facing endpoint** — the frontend only knows about the backend URL
2. **Feature flag** — `SHOP_PURCHASES_BACKEND_PROXY_ENABLED` gates the proxy; only one path is active at a time
3. **Alert** — set up a Prometheus alert if two purchase IDs share the same user + item + timestamp window

The proxy pattern (ADR-001) eliminates the dual-write once fully rolled out.

---

## No dual-write contract

> "When `SHOP_PURCHASES_BACKEND_PROXY_ENABLED=true`, all writes flow exclusively
> through shop-api. The backend never creates a local purchase record and never
> calls shop-api in the background. One request, one write path."
>
> — ADR-001, "Preventing Silent Dual-Writes"

---

## Related links

- [ADR-001: Shop Purchase Write Path Ownership](../backend/docs/ADR-001-shop-purchase-ownership.md)
- [Shop Purchases Runbook](../backend/docs/SHOP_PURCHASES_RUNBOOK.md)
- [shop-api PR Notes (SW-001)](../shop-api/PR-NOTES.md)
- [Backend shop module](../backend/src/modules/shop/)
- [shop-api source](../shop-api/src/)
- [Frontend ShopGrid component](../frontend/src/components/game/ShopGrid.tsx)
- [Frontend PurchaseModal component](../frontend/src/components/ui/purchase-modal.tsx)
