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

### 3. Users Module

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

### 4. Coupons Module

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

### 5. Perks Admin Module

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

### 6. Waitlist Admin Module

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

---

### 7. Chance Module

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
standalone/orphan Express router, controller, or app instance for shop management
