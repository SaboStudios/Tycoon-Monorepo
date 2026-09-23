# Backend Tests

## SQLite vs Postgres

Production runs on **Postgres** (`src/config/database.config.ts`). Most
unit/e2e specs use **`better-sqlite3`** (`:memory:`, `synchronize: true`) for
speed and zero setup — see `auth-token-security.e2e-spec.ts`,
`admin-role-verification.e2e-spec.ts`, `observability.e2e-spec.ts`.

SQLite is a close-enough stand-in for schema/CRUD coverage, but it diverges
from Postgres in ways that can hide bugs or fail outright:

- **`ILIKE`** is Postgres-only. Any suite exercising case-insensitive search
  (e.g. `waitlist.service`, `uploads.service`, `PaginationService`) needs a
  real Postgres connection — these are covered by `*.service.spec.ts` unit
  tests with a mocked repository/query builder instead of an e2e/sqlite DB.
- **`jsonb` columns** (`AuditTrail`, `Upload`, `Perk`, webhook/ledger
  entities) fall back to text storage under sqlite. Basic read/write works,
  but Postgres JSON operators (`->`, `->>`, `@>`) and GIN indexes are not
  exercised.
- **Arrays, `EXTRACT()`, `gen_random_uuid()`** and other Postgres-specific
  SQL are not supported by sqlite.

**Rule of thumb:** if a suite builds raw SQL/QueryBuilder fragments or relies
on Postgres-only column types, run it against real Postgres
(`docker-compose.yml` / `docker-compose.ci.yml`) rather than sqlite.
