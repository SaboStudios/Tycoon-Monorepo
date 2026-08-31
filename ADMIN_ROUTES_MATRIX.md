# Admin Routes Matrix

This document tracks all admin-protected routes across the Tycoon application. Each route must have `AdminGuard` applied at the controller level (via `@UseGuards(JwtAuthGuard, AdminGuard)`).

**Last Updated:** 2026-08-26
**Verification:** Enforced automatically in CI via `backend/scripts/verify-admin-guards.ts`

---

## Route Coverage

| Module | Controller | Route Prefix | Guard Status | Test Coverage |
|--------|-----------|--------------|--------------|--------|
| Audit Trail | `AuditTrailController` | `/admin/audit-trail` | ✅ AdminGuard | e2e |
| Ledger Reconciliation | `LedgerReconciliationController` | `/admin/ledger` | ✅ AdminGuard | e2e |
| Admin Analytics | `AdminAnalyticsController` | `/admin/analytics` | ✅ AdminGuard | e2e |
| Perks | `PerksAdminController` | `/admin/perks` | ✅ AdminGuard | e2e |
| Waitlist | `WaitlistAdminController` | `/admin/waitlist` | ✅ AdminGuard | e2e |
| Shop | `AdminShopController` | `/admin/shop` | ✅ AdminGuard | e2e |
| Auth | `AdminAuthController` | `/admin/auth` | ✅ AdminGuard | e2e |
| Admin Logs | `AdminLogsController` | `/admin/logs` | ✅ AdminGuard | e2e |

---

## Guard Application Pattern

All admin controllers must apply `AdminGuard` at the **class level**:

```typescript
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('admin/...')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSomeController {
  // routes here
}
```

**Key points:**
- `JwtAuthGuard` must be applied first (validates JWT token)
- `AdminGuard` must follow (verifies `is_admin` flag)
- Both decorators are applied to the **controller class**, not individual routes
- If a guard is missing, the CI check (`verify-admin-guards.ts`) will fail the build

---

## CI Enforcement

The CI pipeline includes an automated check:

```bash
# Runs in: GitHub Actions → Backend CI → "Verify admin guard coverage" step
npx ts-node backend/scripts/verify-admin-guards.ts
```

**What it checks:**
1. Scans all `.controller.ts` files in `backend/src`
2. Identifies controllers with `@Controller('admin/...')`
3. Verifies each admin controller has `@UseGuards(...AdminGuard)`
4. Fails the build if any admin controller is missing the guard

**Local testing:**
```bash
cd backend
npx ts-node scripts/verify-admin-guards.ts
```

---

## E2E Test Coverage

All admin routes are covered by `backend/test/admin-role-verification.e2e-spec.ts`:

- Verifies non-admin users receive `403 Forbidden`
- Verifies admin users can access routes without `403`
- Covers error message consistency across guards

Run locally:
```bash
cd backend
npm run test:e2e -- admin-role-verification.e2e-spec.ts
```

---

## Adding a New Admin Route

1. **Create the controller** with route prefix `/admin/...`
2. **Apply guards at class level:**
   ```typescript
   @UseGuards(JwtAuthGuard, AdminGuard)
   @Controller('admin/my-feature')
   export class AdminMyFeatureController { }
   ```
3. **Add e2e test** to `admin-role-verification.e2e-spec.ts` covering:
   - Non-admin user receives 403
   - Admin user receives 200 (or appropriate success code)
4. **CI verification runs automatically** on PR — if guard is missing, build fails

---

## No Intentional Outliers

All admin routes follow the same guard pattern. There are no documented exceptions or outlier routes (routes starting with `/admin` that don't use `AdminGuard`).
