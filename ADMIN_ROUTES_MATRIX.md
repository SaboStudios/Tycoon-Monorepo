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
**class level** so every handler inherits both guards. Per-handler overrides are
not permitted for admin surfaces; add a new row here instead.

## Route matrix

| Method | Path                          | Access | Guards                              | Notes                                  |
| ------ | ----------------------------- | ------ | ----------------------------------- | -------------------------------------- |
| GET    | `/health`                     | public | —                                   | Liveness/readiness probe.              |
| POST   | `/auth/login`                 | public | —                                   | Issues user JWT.                        |
| GET    | `/me`                         | user   | `JwtAuthGuard`                      | Current user profile.                  |
| GET    | `/admin/users`                | admin  | `JwtAuthGuard`, `AdminGuard`        | Paginated; PII minimized in response.  |
| GET    | `/admin/audit`                | admin  | `JwtAuthGuard`, `AdminGuard`        | Redacts secrets/tokens in log views.   |
| POST   | `/admin/actions`              | admin  | `JwtAuthGuard`, `AdminGuard`        | Mutation; writes `AuditTrail` entry.   |
| GET    | `/admin/exports`              | admin  | `JwtAuthGuard`, `AdminGuard`        | Column allowlist; range-limited.       |

## Guard verification

`backend/scripts/verify-admin-guards.ts` (and its spec
`verify-admin-guards.spec.ts`) enforce that every controller listed as `admin`
above uses `@UseGuards(JwtAuthGuard, AdminGuard)` at the class level. CI runs
this check; a failing check blocks merge.

## Auditing requirements

- Every admin mutation MUST write an `AuditTrail` record capturing actor,
  action, target, and timestamp.
- Audit log views MUST redact secrets, tokens, and credentials before display.
- Export endpoints MUST record who exported, the requested range, and the
  applied column allowlist.
- Failure paths MUST still emit an audit record (deny-by-default, fail-closed).

## MSW tree-shake prod bundle audit (SW-FE-1462)

Mock Service Worker (MSW) is a **dev/test-only** dependency. It MUST NOT be
imported from any production entrypoint, and it MUST be tree-shaken out of the
production bundle. The audit below is the source of truth for how MSW is gated
and verified.

### Gating rules

- MSW may only be imported behind a dev/test flag, e.g.
  `if (process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_ENABLE_MSW === 'true')`.
- The MSW worker/browser setup MUST live in a module that is dynamically
  imported (`await import(...)`) so bundlers can drop it when the flag is off.
- Production entrypoints (`frontend/app/layout.tsx`, root providers, and any
  server entrypoint) MUST NOT statically import `msw` or `msw/browser`.
- `msw` MUST be listed under `devDependencies` only; it MUST NOT appear in
  `dependencies`.

### Audit checklist

| Check                                                        | Where verified                                  |
| ------------------------------------------------------------ | ----------------------------------------------- |
| No static `msw` import in prod entrypoints                   | `frontend/app/layout.tsx`, root providers       |
| MSW init guarded by dev/test flag                            | MSW bootstrap module                            |
| MSW bootstrap loaded via dynamic `import()`                  | MSW bootstrap module                            |
| `msw` only in `devDependencies`                              | `frontend/package.json`                         |
| Prod bundle contains no `msw` chunk                          | `frontend-ci.yml` bundle audit step             |

### CI enforcement

`frontend-ci.yml` runs the prod bundle audit: it builds the frontend with
`NODE_ENV=production` and fails if any emitted chunk references `msw`. A failing
audit blocks merge. See
`frontend/docs/SW-FE-1462-msw-tree-shake-prod-bundle-audit.md` for the full
runbook and rollback notes.

## Adding a new route

1. Add the route to the matrix above in the same PR that introduces it.
2. For admin routes, apply `@UseGuards(JwtAuthGuard, AdminGuard)` at the class
   level and ensure `verify-admin-guards` passes.
3. Add an e2e test covering the non-admin `403` path and the admin happy path.
4. Confirm the generated OpenAPI spec emits the correct `security` entry.
