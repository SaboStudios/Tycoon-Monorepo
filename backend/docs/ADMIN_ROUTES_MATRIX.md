# Admin Routes Matrix

This document provides a comprehensive overview of all admin-protected routes in the Tycoon-Monorepo backend application.

## Overview

The backend uses two primary guards for admin access control:
- **AdminGuard**: Checks if `user.is_admin === true`
- **RolesGuard**: Checks if user has required role(s) specified via `@Roles()` decorator

## Guard Enforcement Contract

Every admin controller MUST apply guards at the **class level** so that no route can
accidentally ship unguarded:

```typescript
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin/...')
export class SomeAdminController { ... }
```

- `JwtAuthGuard` MUST come first so the request is authenticated before admin status is checked.
- `AdminGuard` MUST be applied at the class level (not per-method) for admin controllers.
- `RolesGuard` + `@Roles(Role.ADMIN)` is the accepted alternative where role-based access is required.
- Any new admin route MUST be added to this matrix in the same PR that introduces it.

### CI Enforcement

`backend/scripts/verify-admin-guards.ts` statically verifies that every controller listed
below applies the required guards. The `verify-admin-guards` workflow runs this script on
every PR and MUST stay green. If you add an admin controller, add it to the script's
expected-controller list and to this matrix in the same PR.

`backend/scripts/verify-admin-analytics.sh` verifies the admin analytics surface in CI:

- `AdminAnalyticsController` applies `@UseGuards(JwtAuthGuard, AdminGuard)` at the class level.
- Every analytics route is registered in this matrix with a rate limit.
- Heavy aggregation queries are bounded/paginated and exports use an explicit column allowlist.
- Admin analytics mutations write `AuditTrail` entries and redact secrets in log views.

The `verify-admin-analytics` workflow runs this script on every PR and MUST stay green.

## Admin-Protected Routes by Module

### 1. Admin Analytics Module

**Base Path**: `/admin/analytics`  
**Controller**: `AdminAnalyticsController`  
**Guards**: `JwtAuthGuard`, `AdminGuard`

| HTTP Method | Path | Purpose | Guard Used | Rate Limit |
|-------------|------|---------|------------|------------|
| GET | `/admin/analytics/dashboard` | Get dashboard analytics overview | AdminGuard | 5 req/min |
| GET | `/admin/analytics/shop` | Get shop sales & conversion analytics | AdminGuard | 5 req/min |
| GET | `/admin/analytics/users/total` | Get total users count | AdminGuard | 20 req/min |
| GET | `/admin/analytics/users/active` | Get active users count | AdminGuard | 20 req/min |
| GET | `/admin/analytics/games/total` | Get total games count | AdminGuard | 20 req/min |
| GET | `/admin/analytics/games/players/total` | Get total game players count | AdminGuard | 20 req/min |

**Rate Limiting Policy**:
- **Expensive aggregations** (dashboard, shop): 5 requests per minute — Postgres aggregation queries are resource-intensive
- **Simple count queries** (users/games): 20 requests per minute — Direct count() operations with lighter index scans
- Global default: 100 requests per minute
- Health check endpoints (`/health/*`) remain unthrottled
- Exceeding limits returns 429 Too Many Requests

**Aggregation & Export Policy**:
- Heavy aggregation queries MUST be bounded (date range + pagination/limit) to avoid unbounded scans.
- Analytics exports MUST use an explicit column allowlist and MUST NOT include PII beyond what the allowlist permits.
- Export ranges MUST be bounded to prevent export DoS on large ranges.
- Every admin analytics mutation MUST write an `AuditTrail` entry (actor id, action, target, timestamp) on both success and failure paths.
- Admin analytics log views MUST redact secrets (tokens, passwords, API keys, JWTs) before returning data.

---

### 2. Admin Logs Module

**Base Path**: `/admin/logs`  
**Controller**: `AdminLogsController`  
**Guards**: `JwtAuthGuard`, `AdminGuard`

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| GET | `/admin/logs` | Retrieve admin audit logs with filters and pagination | AdminGuard |
| GET | `/admin/logs/export` | Export admin audit logs as CSV | AdminGuard |

**Audit & Redaction Policy**:
- Every admin mutation MUST write an `AuditTrail` entry (actor id, action, target, timestamp).
- Audit entries MUST be written on both success and failure paths so failed mutations are traceable.
- Admin log views and exports MUST redact secrets (tokens, passwords, API keys, JWTs) before returning data.
- Exports MUST use an explicit column allowlist and MUST NOT include PII beyond what the allowlist permits.
- Export ranges MUST be bounded/paginated to prevent export DoS on large ranges.

---

### 3. Admin Ledger Module

**Base Path**: `/admin/ledger`  
**Controller**: `AdminLedgerController`  
**Guards**: `JwtAuthGuard`, `AdminGuard` (class-level)

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| GET | `/admin/ledger` | List ledger entries with pagination and filters | AdminGuard |
| GET | `/admin/ledger/export` | Export ledger entries as CSV with PII-minimized columns | AdminGuard |

**Export column allowlist (PII-minimized):**

| Column | Source | Notes |
|--------|--------|-------|
| `id` | `entry.id` | Ledger entry identifier |
| `created_at` | `entry.createdAt` | ISO-8601 timestamp |
| `type` | `entry.type` | Ledger entry type |
| `amount` | `entry.amount` | Numeric amount |
| `currency` | `entry.currency` | Currency code |
| `status` | `entry.status` | Entry status |
| `reference` | `entry.reference` | Internal reference (no PII) |
| `user_ref` | `entry.userId` | Opaque user reference (hashed/ID only, no email/name) |

**Explicitly excluded from export:** raw email, display name, wallet address, IP address, auth tokens, and any other direct PII or secrets. Secrets are redacted in admin log views.

**Export safeguards:**
- Export range is capped (max range size) to prevent export DoS on large ranges.
- Heavy ledger queries are paginated/limited.
- Every export writes an `AuditTrail` entry recording who exported and the requested range.

---

### 4. Users Module

**Base Path**: `/users`  
**Controller**: `UsersController`  
**Guards**: `JwtAuthGuard`, `AdminGuard` (on specific endpoints)

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| GET | `/users` | List all users with pagination | AdminGuard |
| PATCH | `/users/:id` | Update a user by ID | AdminGuard |
| DELETE | `/users/:id` | Delete a user by ID | AdminGuard |
| POST | `/users/suspend` | Suspend a user account | AdminGuard |
| POST | `/users/unsuspend` | Unsuspend a user account | AdminGuard |
| GET | `/users/:id/suspensions` | Get suspension history for a user | AdminGuard |

---

### 5. Coupons Module

**Base Path**: `/coupons`  
**Controller**: `CouponsController`  
**Guards**: `JwtAuthGuard`, `AdminGuard` (on specific endpoints)

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| POST | `/coupons` | Create a new coupon | AdminGuard |
| PATCH | `/coupons/:id` | Update a coupon | AdminGuard |
| DELETE | `/coupons/:id` | Delete a coupon | AdminGuard |
| GET | `/coupons/:id/usage-logs` | Get coupon usage logs | AdminGuard |
| GET | `/coupons/:id/statistics` | Get coupon usage statistics | AdminGuard |

---

### 6. Perks Admin Module

**Base Path**: `/admin/perks`  
**Controller**: `PerksAdminController`  
**Guards**: `JwtAuthGuard`, `AdminGuard`

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| POST | `/admin/perks` | Create a new perk | AdminGuard |
| GET | `/admin/perks` | List all perks with pagination and filters | AdminGuard |
| GET | `/admin/perks/:id` | Get a perk by ID | AdminGuard |
| PATCH | `/admin/perks/:id` | Update a perk | AdminGuard |
| DELETE | `/admin/perks/:id` | Delete a perk (hard delete) | AdminGuard |
| PATCH | `/admin/perks/:id/activate` | Activate a perk | AdminGuard |
| PATCH | `/admin/perks/:id/deactivate` | Deactivate a perk | AdminGuard |
| GET | `/admin/perks/:perkId/boosts` | List boosts for a perk | AdminGuard |
| POST | `/admin/perks/:perkId/boosts` | Create a boost for a perk | AdminGuard |
| PATCH | `/admin/perks/:perkId/boosts/:boostId` | Update a boost | AdminGuard |
| DELETE | `/admin/perks/:perkId/boosts/:boostId` | Delete a boost | AdminGuard |

---

### 7. Waitlist Admin Module

**Base Path**: `/admin/waitlist`  
**Controller**: `WaitlistAdminController`  
**Guards**: `JwtAuthGuard`, `AdminGuard`

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| GET | `/admin/waitlist` | Retrieve all waitlist entries with pagination and filtering | AdminGuard |
| GET | `/admin/waitlist/export` | Export waitlist entries as CSV or Excel | AdminGuard |
| POST | `/admin/waitlist/bulk-import` | Bulk import waitlist entries from CSV | AdminGuard |
| PATCH | `/admin/waitlist/:id` | Update a waitlist entry | AdminGuard |
| DELETE | `/admin/waitlist/:id` | Soft delete a waitlist entry | AdminGuard |
| DELETE | `/admin/waitlist/:id/permanent` | Permanently delete a waitlist entry | AdminGuard |

**Bulk Import Limits** (`POST /admin/waitlist/bulk-import`):
- **Maximum file size**: 10 MB (exceeding returns HTTP 413 Payload Too Large)
- **Maximum rows**: 10,000 data rows (exceeding returns HTTP 400 Bad Request)
- Limits are enforced early in the streaming pipeline before database processing to prevent OOM or DoS attacks
- Error responses include the specific limit exceeded and its configured value

---

### 8. Chance Module

**Base Path**: `/chances`  
**Controller**: `ChanceController`  
**Guards**: `JwtAuthGuard`, `RolesGuard` (on specific endpoints)

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| POST | `/chances` | Create a new chance card | RolesGuard + @Roles(Role.ADMIN) |

---

### 8. Admin Shop Module

**Base Path**: `/admin/shop`  
**Controller**: `AdminShopController` (`src/modules/shop/admin-shop.controller.ts`)  
**Guards**: `JwtAuthGuard`, `AdminGuard`

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| PATCH | `/admin/shop/:id/price` | Update a shop item's price (ISO 4217 currency, min 0.01) | AdminGuard |
| PATCH | `/admin/shop/:id/status` | Toggle a shop item's active status | AdminGuard |
| POST | `/admin/shop/:id/upload` | Upload up to 5 images for a shop item | AdminGuard |
| POST | `/admin/shop/bulk/update` | Bulk update 1-100 shop items (partial-success — see below) | AdminGuard |

**Note (#1280 — orphan Express tree audit)**: admin shop management was fully migrated
from an earlier, pre-Nest implementation into `AdminShopController` under `ShopModule`
(see commit `22adf0d`, #858). This audit re-confirmed there is no remaining
standalone/orphan Express router, controller, or app instance for shop management.

---

### 9. Games Replay Admin Module

**Base Path**: `/admin/games/replay`  
**Controller**: `GamesReplayAdminController` (`src/modules/games/admin/games-replay-admin.controller.ts`)  
**Guards**: `JwtAuthGuard`, `AdminGuard` (class-level via `@UseGuards(JwtAuthGuard, AdminGuard)`)

| HTTP Method | Path | Purpose | Guard Used |
|-------------|------|---------|------------|
| GET | `/admin/games/replay` | List deterministic replay events with pagination and filters | AdminGuard |
| GET | `/admin/games/replay/:id` | Get a single replay event by ID | AdminGuard |
| GET | `/admin/games/replay/export` | Export replay events as CSV with PII-minimized columns | AdminGuard |

**Deterministic event store:**
- Replay events are append-only and ordered by a monotonic `sequence` per game session; the server is the source of truth for dice, board tiles, inventory, and money.
- Mutations (create/update/delete of replay records) write an `AuditTrail` entry recording actor, action, target, and timestamp.
- Concurrent duplicate requests are idempotent via a deterministic `eventId` (client retries/reconnects do not create duplicate events).
- Writes fail-closed when Postgres/Redis/shop-api/RPC dependencies are unavailable.

**Export column allowlist (PII-minimized):**

| Column | Source | Notes |
|--------|--------|-------|
| `id` | `event.id` | Replay event identifier |
| `sequence` | `event.sequence` | Monotonic per-session ordering |
| `created_at` | `event.createdAt` | ISO-8601 timestamp |
| `game_id` | `event.gameId` | Game session identifier |
| `event_type` | `event.type` | Deterministic event type |
| `payload_hash` | `event.payloadHash` | Hash of payload (no raw payload/PII) |
| `user_ref` | `event.userId` | Opaque user reference (ID only, no email/name) |

**Explicitly excluded from export:** raw event payloads, email, display name, wallet address, IP address, auth tokens, and any other direct PII or secrets. Secrets/tokens are redacted in admin log views.

**Export safeguards:**
- Export range is capped (max range size) to prevent export DoS on large ranges.
- Heavy replay queries are paginated/limited.
- Every export writes an `AuditTrail` entry recording who exported and the requested range.

**Authorization:**
- Non-admin tokens receive HTTP 403 Forbidden (covered by `admin-role-verification.e2e`).
- `verify-admin-guards.ts` validates class-level guards on this controller in CI.

---

### 10. Admin Shop Bulk Update Notes

**Note (#1280):** Bulk update returns partial success — see module docs for per-item error reporting.
