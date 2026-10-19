# Admin Routes Matrix

This document is the source of truth for which backend routes are admin-only,
which are user-authenticated, and which are public. It also defines the OpenAPI
security schemes that `backend/scripts/generate-openapi.ts` must emit so that
admin and user routes are distinguishable in generated specs and clients.

## OpenAPI security schemes

| Scheme name        | Type   | Location | Description                                                        |
| ------------------ | ------ | -------- | ------------------------------------------------------------------ |
| `bearer`           | http   | header   | Standard user JWT (`Authorization: Bearer <token>`).               |
| `adminBearer`      | http   | header   | Admin JWT. Same transport as `bearer` but requires the admin role. |

- **User routes** declare `security: [{ bearer: [] }]`.
- **Admin routes** declare `security: [{ bearer: [], adminBearer: [] }]` so that
  generated clients surface the admin-role requirement in addition to the
  bearer token.
- **Public routes** declare no `security` entry.

Admin controllers MUST apply `@UseGuards(JwtAuthGuard, AdminGuard)` at the
**class level** (deny-by-default). Mutating admin handlers (Post/Put/Patch/Delete)
MUST be covered by an appropriate AuditTrail interceptor/service call.

## Route table

| Method | Path                          | Access | Guards                              | Notes                                  |
| ------ | ----------------------------- | ------ | ----------------------------------- | -------------------------------------- |
| GET    | `/health`                     | public | —                                   | Liveness/readiness probe.              |
| POST   | `/auth/login`                 | public | —                                   | Issues user JWT.                        |
| GET    | `/me`                         | user   | `JwtAuthGuard`                      | Current user profile.                  |
| GET    | `/admin/users`                | admin  | `JwtAuthGuard`, `AdminGuard`        | Paginated; PII minimized in response.  |
| POST   | `/admin/users/invite`         | admin  | `JwtAuthGuard`, `AdminGuard`        | Invite admin; no shared passwords.     |
| POST   | `/admin/users/:id/disable`    | admin  | `JwtAuthGuard`, `AdminGuard`        | Disable admin; writes `AuditTrail`.    |
| GET    | `/admin/audit`                | admin  | `JwtAuthGuard`, `AdminGuard`        | Redacts secrets/tokens in log views.   |
| POST   | `/admin/actions`              | admin  | `JwtAuthGuard`, `AdminGuard`        | Mutation; writes `AuditTrail` entry.   |
| GET    | `/admin/exports`              | admin  | `JwtAuthGuard`, `AdminGuard`        | Column allowlist; range-limited.       |

| Prefix / Pattern                     | Type       | Auth                  | Guards / Notes                                                              |
| ------------------------------------ | ---------- | --------------------- | --------------------------------------------------------------------------- |
| `GET /admin/analytics/dashboard`     | Admin-only | JwtAuth, AdminGuard   | Analytics dashboard data. Read-only.                                        |
| `GET /admin/analytics/users/total`   | Admin-only | JwtAuth, AdminGuard   | Total user count. Read-only.                                                |
| `GET /admin/analytics/users/active`  | Admin-only | JwtAuth, AdminGuard   | Active user count. Read-only.                                               |
| `GET /admin/analytics/games/total`   | Admin-only | JwtAuth, AdminGuard   | Total game count. Read-only.                                                |
| `GET /admin/logs`                    | Admin-only | JwtAuth, AdminGuard   | Paginated audit log. Redacts secrets.                                       |
| `GET /admin/logs/export`             | Admin-only | JwtAuth, AdminGuard   | CSV export of audit logs (max 10k rows). Redacts secrets.                   |
| `GET /admin/perks`                   | Admin-only | JwtAuth, AdminGuard   | Paginated perk list for admin.                                              |
| `POST /admin/perks`                  | Admin-only | JwtAuth, AdminGuard   | Create a perk. Audit trail.                                                 |
| `PATCH /admin/perks/:id`             | Admin-only | JwtAuth, AdminGuard   | Update a perk. Audit trail.                                                 |
| `DELETE /admin/perks/:id`            | Admin-only | JwtAuth, AdminGuard   | Soft-delete a perk. Audit trail.                                            |
| `POST /admin/perks/boosts`           | Admin-only | JwtAuth, AdminGuard   | Create a boost. Audit trail.                                                |
| `GET /admin/perks/boosts`            | Admin-only | JwtAuth, AdminGuard   | List boosts.                                                                |
| `PATCH /admin/perks/boosts/:id`      | Admin-only | JwtAuth, AdminGuard   | Update a boost. Audit trail.                                                |
| `DELETE /admin/perks/boosts/:id`     | Admin-only | JwtAuth, AdminGuard   | Soft-delete a boost. Audit trail.                                           |
| `GET /admin/waitlist`                | Admin-only | JwtAuth, AdminGuard   | Paginated waitlist. Redacts emails in logs.                                 |
| `POST /admin/waitlist/import`        | Admin-only | JwtAuth, AdminGuard   | CSV bulk import. Audit trail.                                               |
| `GET /admin/waitlist/export`         | Admin-only | JwtAuth, AdminGuard   | CSV export. Column allowlist, max 10k rows.                                 |
| `PATCH /admin/waitlist/:id`          | Admin-only | JwtAuth, AdminGuard   | Update waitlist entry. Audit trail.                                         |
| `DELETE /admin/waitlist/:id`         | Admin-only | JwtAuth, AdminGuard   | Delete waitlist entry. Audit trail.                                         |
| `GET /admin/ledger/export`           | Admin-only | JwtAuth, AdminGuard   | CSV export with PII-minimized column allowlist, max 10k rows. Audit trail.  |
| `POST /admin/ledger-reconciliation/run`            | Admin-only | JwtAuth, AdminGuard   | Trigger reconciliation. Audit trail.                         |
| `GET /admin/ledger-reconciliation/discrepancies`    | Admin-only | JwtAuth, AdminGuard   | List discrepancies. Read-only.                               |
| `PATCH /admin/ledger-reconciliation/discrepancies/:id/resolve` | Admin-only | JwtAuth, AdminGuard | Resolve discrepancy. Audit trail.                 |
| `POST /admin/coupons`                | Admin-only | JwtAuth, AdminGuard   | Create coupon. Audit trail.                                                  |
| `GET /admin/coupons`                 | Admin-only | JwtAuth, AdminGuard   | List coupons.                                                                |
| `PATCH /admin/coupons/:id`           | Admin-only | JwtAuth, AdminGuard   | Update coupon. Audit trail.                                                  |
| `DELETE /admin/coupons/:id`          | Admin-only | JwtAuth, AdminGuard   | Delete coupon. Audit trail.                                                  |
| `GET /perks/inventory/:playerId`     | User       | JwtAuth               | Player's own inventory.                                                      |
| `POST /perks/inventory/bulk`         | Admin-only | JwtAuth, AdminGuard   | Bulk-add perks to inventory. Audit trail.                                    |
| `POST /perks/equip`                  | User       | JwtAuth               | Equip a perk. Audit trail.                                                   |
| `POST /perks/unequip`                | User       | JwtAuth               | Unequip a perk. Audit trail.                                                 |
| `POST /perks/use`                    | User       | JwtAuth               | Activate a perk in a game. Audit trail.                                      |
| `POST /perks/activate`               | User       | JwtAuth               | Activate a perk boost. Audit trail.                                          |
| `POST /perks`                        | Admin-only | JwtAuth, AdminGuard   | Create a perk definition. Audit trail.                                       |
| `GET /perks/analytics/*`             | Admin-only | JwtAuth, AdminGuard   | Perk analytics dashboards and exports.                                       |
| `POST /shop/items`                   | Admin-only | JwtAuth, AdminGuard   | Create a shop item. Audit trail.                                             |
| `PATCH /shop/items/:id`              | Admin-only | JwtAuth, AdminGuard   | Update a shop item. Audit trail.                                             |
| `DELETE /shop/items/:id`             | Admin-only | JwtAuth, AdminGuard   | Soft-delete a shop item. Audit trail.                                        |
| `GET /shop/items`                    | Public     | None                  | Public shop listing (cached).                                                |
| `GET /shop/items/:id`                | Public     | None                  | Public shop item detail (cached).                                            |
| `POST /shop/purchase`                | User       | JwtAuth               | Purchase an item.                                                            |
| `POST /shop/gift`                    | User       | JwtAuth               | Purchase and gift an item.                                                   |
| `GET /shop/purchases`                | User       | JwtAuth               | Purchase history for authenticated user.                                     |
| `GET /shop/purchases/:id`            | User       | JwtAuth               | Purchase detail for own purchase.                                            |
| `GET /shop/inventory`                | User       | JwtAuth               | User's inventory items.                                                      |
| `GET /shop/inventory/active`         | User       | JwtAuth               | Active (non-expired) inventory items.                                        |

## Public / user routes (no admin guard)

Routes under `@Controller('auth')`, `@Controller('users/me')`, `@Controller('perks')` (GET only),
`@Controller('games')`, `@Controller('chances')`, `@Controller('gifts')`, `@Controller('tour')`
are either public or user-authenticated. User routes apply `@UseGuards(JwtAuthGuard)` (or a more
specific guard) as needed. Public routes have no auth guard.

## Export protection rules

Every admin CSV/JSON export endpoint MUST:
1. Use an explicit **column allowlist** — never pass raw entity columns to csv/json output.
2. Enforce a **row limit** (`EXPORT_MAX_ROWS`, at most 10 000).
3. **Redact PII** (email, phone, address, wallet, display name, IP, tokens) from log/audit views.
4. **Audit** the export action via `AuditTrailService` / `@AuditLog()`.

## Non-admin 403 enforcement

Any request to an admin-prefixed route (or admin-only non-prefixed route) with a missing or
non-admin JWT MUST return HTTP 403 Forbidden. This is enforced at the guard level by
`AdminGuard` (throws `ForbiddenException`). E2E tests verify this contract.

## Controllers with `@UseGuards(JwtAuthGuard, AdminGuard)` at class level

- `AdminAnalyticsController` (`admin/analytics`)
- `AdminLogsController` (`admin/logs`)
- `PerksAdminController` (`admin/perks`)
- `WaitlistAdminController` (`admin/wait`

## Admin invite/disable without shared passwords

Admin onboarding and offboarding MUST NOT rely on shared or static passwords.

- **Invite** (`POST /admin/users/invite`): the server issues a single-use,
  time-boxed invite token bound to the invitee's email and the inviting admin.
  The token is delivered out-of-band; it is never logged, returned in API
  responses, or stored in plaintext. The invitee sets their own credential on
  first use. Invites are idempotent per `(email, inviter)` within the token TTL
  so reconnect/duplicate retries do not mint multiple tokens.
- **Disable** (`POST /admin/users/:id/disable`): disabling revokes active
  sessions and pending invites for the target admin. The operation is
  idempotent; disabling an already-disabled admin is a no-op that still records
  an audit entry.
- Both endpoints are deny-by-default: a missing/invalid token or a non-admin
  role receives `403` and the failure is audited.
- Audit records for invite/disable capture actor, action, target, and outcome,
  and redact the invite token and any credential material.

## MSW tree-shake prod bundle audit (SW-FE-1462)

y `@UseGuards(JwtAuthGuard)` (or a more
specific guard) as needed. Public routes have no auth guard.

## Export protection rules

Every admin CSV/JSON export endpoint MUST:
1. Use an explicit **column allowlist** — never pass raw entity columns to csv/json output.
2. Enforce a **row limit** (`EXPORT_MAX_ROWS`, at most 10 000).
3. **Redact PII** (email, phone, address, wallet, display name, IP, tokens) from log/audit views.
4. **Audit** the export action via `AuditTrailService` / `@AuditLog()`.


Any request to an admin-prefixed route (or admin-only non-prefixed route) with a missing or
non-admin JWT MUST return HTTP 403 Forbidden. This is enforced at the guard level by
`AdminGuard` (throws `ForbiddenException`). E2E tests verify this contract.

## Controllers with `@UseGuards(JwtAuthGuard, AdminGuard)` at class level

- `AdminAnalyticsController` (`admin/analytics`)
- `AdminLogsController` (`admin/logs`)
- `PerksAdminController` (`admin/perks`)
- `WaitlistAdminController` (`admin/waitlist`)
- `LedgerController` (`admin/ledger`)
- `LedgerReconciliationController` (`admin/ledger-reconciliation`)
- `CouponsController` (admin methods use per-handler guards)
- `PerksAnalyticsController` (`perks/analytics`)
- `ShopController` (admin methods use per-handler guards)

## Controllers with AuditTrail coverage on mutations

- `AdminLogsController` — `@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog()`
- `PerksAdminController` — `@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog()`
- `WaitlistAdminController` — `@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog()`
- `CouponsController` — `@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog()`
- `LedgerController` — Manual `auditTrailService.record()`
- `LedgerReconciliationController` — `@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog()`
- `PerksBoostsController` (`perks-boosts`) — `@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog()`
- `ShopController` — `@UseInterceptors(AuditTrailInterceptor)` + `@AuditLog()` on mutations