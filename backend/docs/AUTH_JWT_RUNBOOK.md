# Auth & JWT Runbook

Operational runbook for the authentication and JWT subsystem (`backend/src/modules/auth`).
The "runbook contract" spec (`src/modules/auth/auth-runbook.spec.ts`) asserts that the
names documented here stay in sync with the implementation.

## 1. Environment variables

All JWT settings are read from the process environment. The canonical source is
`src/config/jwt.config.ts` (the `jwt` config namespace registered with `@nestjs/config`).

| Variable | Format | Default | Required |
| --- | --- | --- | --- |
| `JWT_SECRET` | Non-empty string (HMAC signing key, e.g. 32+ random bytes) | `dev-only-insecure-jwt-secret` in non-production; **no default in production** | **Yes in production** — the app refuses to start if it is empty or set to the placeholder `your-secret-key-change-this-in-production` |
| `JWT_EXPIRES_IN` | Duration string or seconds, e.g. `15m`, `7d`, `900` | `7d` (`jwt.config.ts`); the auth module falls back to `900` seconds if unset | No |
| `JWT_REFRESH_EXPIRES_IN` | Duration string or seconds, e.g. `7d`, `30d` | `7d` | No |
| `JWT_CLOCK_SKEW_SECONDS` | Integer number of seconds | `60` | No |

Notes:

- Lifetime values use the `ms`/`jsonwebtoken` duration pattern, e.g. `15m` for a
  fifteen-minute access token, `7d` for a seven-day refresh token.
- `JWT_SECRET` must never be committed. Generate it per environment and store it in the
  secret manager; rotate it by deploying a new value and invalidating refresh tokens.
- `JWT_CLOCK_SKEW_SECONDS` is applied as the JWT `clockTolerance` when verifying tokens,
  tolerating small clock drift between services.

Example (non-production):

```env
JWT_SECRET=dev-only-insecure-jwt-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
JWT_CLOCK_SKEW_SECONDS=60
```

## 2. Audit events

Auth audit entries use the canonical event names from
`src/modules/auth/audit/auth-audit.events.ts`:

| Event | Meaning |
| --- | --- |
| `AUTH_LOGIN_SUCCESS` | Password login succeeded |
| `AUTH_LOGOUT` | User logged out / session revoked |
| `AUTH_TOKEN_REFRESHED` | Refresh token exchanged for a new access token |
| `AUTH_WALLET_LOGIN_SUCCESS` | Wallet-signature login succeeded |
| `AUTH_REGISTER_SUCCESS` | New account registered |
| `AUTH_LOGIN_FAILED` | Password login failed (WARN) |
| `AUTH_LOGIN_SUSPENDED` | Login attempted on a suspended account (WARN) |
| `AUTH_TOKEN_REUSE_DETECTED` | A revoked/rotated refresh token was replayed (WARN) |
| `AUTH_TOKEN_REFRESH_FAILED` | Refresh attempt rejected (WARN) |
| `AUTH_WALLET_LOGIN_FAILED` | Wallet-signature login failed (WARN) |

Events marked WARN are routed to the security log stream by `AuthAuditService`
(`src/modules/auth/audit/auth-audit.service.ts`).

## 3. `refresh_tokens` schema

Table `refresh_tokens` (`src/modules/auth/entities/refresh-token.entity.ts`):

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | Primary key |
| `tokenHash` | string | Hash of the refresh token; the raw token is never stored |
| `userId` | int | FK to `users.id`, `ON DELETE CASCADE` |
| `expiresAt` | timestamp | Absolute expiry derived from `JWT_REFRESH_EXPIRES_IN` |
| `isRevoked` | boolean | Default `false`; set on logout/rotation/reuse detection |
| `createdAt` | timestamp | Row creation time |
| `lastUsedAt` | timestamp, nullable | Updated on each successful refresh |
| `ipAddress` | string, nullable | Request IP at issue time |
| `userAgent` | string, nullable | Request user agent at issue time |

## 4. Common operations

- **Rotate the signing secret**: set a new `JWT_SECRET`, deploy, then revoke all rows in
  `refresh_tokens` (`isRevoked = true`) so clients must re-authenticate.
- **Investigate token reuse**: query `refresh_tokens` for the affected `userId` and look
  for `AUTH_TOKEN_REUSE_DETECTED` audit entries; revoke the whole family.
- **Clock drift errors** (`TokenExpiredError` / `notBefore`): confirm host clocks are
  NTP-synced before raising `JWT_CLOCK_SKEW_SECONDS`.
