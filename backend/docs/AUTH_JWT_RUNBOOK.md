# Auth & JWT — Operational Runbook

**Stellar Wave batch · SW-BE-006**
Covers the NestJS auth module at `backend/src/modules/auth/`.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environment Variables](#2-environment-variables)
3. [Normal Operations](#3-normal-operations)
4. [Incident Playbooks](#4-incident-playbooks)
   - 4.1 [Token Reuse / Replay Attack](#41-token-reuse--replay-attack)
   - 4.2 [Suspended-User Login Attempts](#42-suspended-user-login-attempts)
   - 4.3 [Elevated Login Failures](#43-elevated-login-failures)
   - 4.4 [Expired / Invalid Token Flood](#44-expired--invalid-token-flood)
   - 4.5 [Force-Logout a Specific User](#45-force-logout-a-specific-user)
   - 4.6 [Rotate the JWT Secret](#46-rotate-the-jwt-secret)
   - 4.7 [Clock Skew Errors](#47-clock-skew-errors)
5. [Audit Log Reference](#5-audit-log-reference)
6. [Database — refresh_tokens Table](#6-database--refresh_tokens-table)
7. [Monitoring & Alerting](#7-monitoring--alerting)
8. [Rollback Procedure](#8-rollback-procedure)
9. [Migration Notes](#9-migration-notes)

---

## 1. Architecture Overview

```
Client
  │
  ├─ POST /api/v1/auth/login          → LocalStrategy → AuthService.login()
  ├─ POST /api/v1/auth/refresh        → AuthService.refreshTokens()
  ├─ POST /api/v1/auth/logout         → AuthService.logout()
  ├─ POST /api/v1/auth/wallet-login   → AuthService.walletLogin()
  ├─ POST /api/v1/auth/register       → UsersService.create()
  └─ POST /api/v1/admin/login         → AdminAuthController → AuthService.validateAdmin()
```

**Token lifecycle:**

```
login ──► access token (15 min, HS256)
      └─► refresh token (7 days, stored as SHA-256 hash in refresh_tokens)
              │
              ├─ POST /refresh ──► new access + new refresh (rotation)
              │                    old refresh token marked isRevoked=true
              │
              └─ reuse of revoked token ──► ALL user tokens revoked
                                            AUTH_TOKEN_REUSE_DETECTED audit event
```

**Key security properties (implemented in SW-BE-003/004/005):**

| Property | Implementation |
|---|---|
| Token hashing | SHA-256 stored in `tokenHash`; raw token never persisted |
| Replay prevention | Single-use enforcement; reuse triggers family revocation |
| DTO validation | `class-validator` on all auth DTOs; `ValidationPipe` global |
| Audit trail | `AuthAuditService` emits structured log entries for every event |
| No secrets in logs | Emails redacted (`p***@domain.com`); tokens never logged |
| Clock skew | `JWT_CLOCK_SKEW_SECONDS` tolerance on verify |

---

## 2. Environment Variables

All variables are validated at startup via `src/config/jwt.config.ts`.

| Variable | Default | Required in prod | Purpose |
|---|---|---|---|
| `JWT_SECRET` | `your-secret-key-change-this-in-production` | **YES** | HS256 signing key — must be ≥ 32 random bytes |
| `JWT_EXPIRES_IN` | `15m` | no | Access token lifetime (e.g. `15m`, `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | no | Refresh token lifetime |
| `JWT_CLOCK_SKEW_SECONDS` | `60` | no | Clock tolerance for token verification |

> **Production checklist:**
> - `JWT_SECRET` must be set to a cryptographically random value (e.g. `openssl rand -hex 32`).
> - Never commit `JWT_SECRET` to source control.
> - Rotate the secret using the procedure in [§4.6](#46-rotate-the-jwt-secret).

---

## 3. Normal Operations

### Check auth service health

```bash
# Verify the API is up and JWT config is loaded
curl -s https://<host>/api/v1/health | jq .
```

### Inspect active refresh tokens for a user

```sql
-- Read-only query
SELECT id, "userId", "expiresAt", "isRevoked", "ipAddress", "lastUsedAt"
FROM refresh_tokens
WHERE "userId" = <user_id>
ORDER BY "createdAt" DESC;
```

### Count active (non-revoked) sessions

```sql
SELECT "userId", COUNT(*) AS active_sessions
FROM refresh_tokens
WHERE "isRevoked" = false AND "expiresAt" > NOW()
GROUP BY "userId"
ORDER BY active_sessions DESC
LIMIT 20;
```

### Run auth tests

```bash
# Unit tests (fast, no DB)
npx jest --config jest.config.ts --testPathPatterns="auth" --no-coverage

# Token security integration tests (requires SQLite in-memory)
npx jest --config jest.config.ts --testPathPatterns="auth-token-security" --no-coverage
```

---

## 4. Incident Playbooks

### 4.1 Token Reuse / Replay Attack

**Signal:** `WARN` log line containing `[AUDIT] AUTH_TOKEN_REUSE_DETECTED`

**What happened:** A refresh token that was already consumed (rotated) was presented again. This indicates either a stolen token being replayed or a client bug (caching old tokens).

**Automatic response (already in place):**
- All refresh tokens for the affected user are immediately revoked.
- The user must re-authenticate.

**Manual investigation steps:**

1. Find the event in logs:
   ```
   grep 'AUTH_TOKEN_REUSE_DETECTED' <log-file> | jq .
   ```
   The entry includes `userId`, `ipAddress`, and `userAgent`.

2. Check if the IP is unusual for this user:
   ```sql
   SELECT DISTINCT "ipAddress", "userAgent", MAX("lastUsedAt") AS last_seen
   FROM refresh_tokens
   WHERE "userId" = <user_id>
   GROUP BY "ipAddress", "userAgent"
   ORDER BY last_seen DESC;
   ```

3. If the IP is foreign/suspicious, treat as account compromise:
   - Notify the user to change their password.
   - Check `admin_logs` for any admin actions taken under this account.
   - Consider temporarily suspending the account (`users.is_suspended = true`) while investigating.

4. If the IP matches the user's normal pattern, it is likely a client bug (double-submit, stale cache). No security action needed beyond the automatic revocation.

---

### 4.2 Suspended-User Login Attempts

**Signal:** `WARN` log line containing `[AUDIT] AUTH_LOGIN_SUSPENDED`

**What happened:** A user whose `is_suspended = true` attempted to log in.

**Steps:**

1. Confirm the suspension is intentional:
   ```sql
   SELECT id, email, "is_suspended", "updatedAt" FROM users WHERE id = <user_id>;
   ```

2. Check `admin_logs` for the suspension action:
   ```sql
   SELECT * FROM admin_logs
   WHERE "targetId" = <user_id> AND action LIKE '%SUSPEND%'
   ORDER BY created_at DESC LIMIT 5;
   ```

3. If the suspension should be lifted, update via the admin API:
   ```bash
   PATCH /api/v1/admin/users/<user_id>
   Authorization: Bearer <admin_token>
   { "is_suspended": false }
   ```

---

### 4.3 Elevated Login Failures

**Signal:** Spike in `[AUDIT] AUTH_LOGIN_FAILED` events from the same IP.

**Steps:**

1. Identify the source:
   ```
   grep 'AUTH_LOGIN_FAILED' <log-file> | jq -r '.ipAddress' | sort | uniq -c | sort -rn | head
   ```

2. If a single IP is responsible for > 20 failures in 5 minutes, it is likely a credential-stuffing or brute-force attempt.

3. Block the IP at the load balancer / WAF level.

4. The throttle guard (`@Throttle({ limit: 5, ttl: 60000 })`) on `/auth/login` and `/admin/login` already limits to 5 attempts per minute per IP. Verify it is active:
   ```bash
   grep -r 'Throttle' src/modules/auth/auth.controller.ts
   ```

5. If the target account exists, consider proactively suspending it and notifying the user.

---

### 4.4 Expired / Invalid Token Flood

**Signal:** Spike in `[AUDIT] AUTH_TOKEN_REFRESH_FAILED` with `reason: expired` or HTTP 401 responses on `/auth/refresh`.

**Likely causes:**
- Client not refreshing tokens before expiry (client bug).
- `JWT_REFRESH_EXPIRES_IN` was shortened and existing tokens expired en masse.
- Clock drift between client and server exceeding `JWT_CLOCK_SKEW_SECONDS`.

**Steps:**

1. Check current token lifetime config:
   ```bash
   echo $JWT_REFRESH_EXPIRES_IN   # should be 7d
   echo $JWT_CLOCK_SKEW_SECONDS   # should be 60
   ```

2. If clock drift is suspected, check server time:
   ```bash
   date -u && timedatectl status
   ```
   Increase `JWT_CLOCK_SKEW_SECONDS` temporarily if NTP sync is lagging.

3. If a config change shortened token lifetimes, communicate to clients that they must re-authenticate and restore the previous value.

---

### 4.5 Force-Logout a Specific User

Revokes all active refresh tokens for a user, forcing re-authentication on next request.

**Via admin API (preferred):**
```bash
POST /api/v1/admin/users/<user_id>/revoke-tokens
Authorization: Bearer <admin_token>
```

**Via database (break-glass only):**
```sql
-- Confirm before running
SELECT COUNT(*) FROM refresh_tokens WHERE "userId" = <user_id> AND "isRevoked" = false;

-- Execute
UPDATE refresh_tokens
SET "isRevoked" = true
WHERE "userId" = <user_id> AND "isRevoked" = false;
```

> Always prefer the API route so the action is recorded in `admin_logs`.

---

### 4.6 Rotate the JWT Secret

Rotating `JWT_SECRET` immediately invalidates **all** existing access tokens. Refresh tokens are stored as hashes and are unaffected by the secret rotation, but the new access tokens issued after rotation will use the new secret.

**Procedure:**

1. Generate a new secret:
   ```bash
   openssl rand -hex 32
   ```

2. Update the secret in your secrets manager / environment (do **not** commit it).

3. Deploy the new config. The rolling deploy will briefly have instances with both old and new secrets. During this window some access tokens will fail verification — clients will fall back to refresh, which is safe.

4. After all instances are on the new secret, old access tokens (max 15 min lifetime) will expire naturally.

5. Verify no `AUTH_TOKEN_REUSE_DETECTED` spike occurs post-rotation (there should be none — refresh tokens are not affected).

**Zero-downtime option:** Run two instances temporarily — one with the old secret, one with the new — behind the load balancer, then drain the old instance.

---

### 4.7 Clock Skew Errors

**Signal:** Legitimate tokens rejected with `jwt not active` or `jwt expired` errors despite being recently issued.

**Steps:**

1. Check NTP sync on all app servers:
   ```bash
   timedatectl status | grep 'synchronized'
   chronyc tracking   # if using chrony
   ```

2. Temporarily increase tolerance while fixing NTP:
   ```bash
   JWT_CLOCK_SKEW_SECONDS=120   # bump from 60 to 120
   ```
   Redeploy. Revert once clocks are synchronised.

3. Do not set `JWT_CLOCK_SKEW_SECONDS` above `300` — this widens the replay window.

---

## 5. Audit Log Reference

All events are emitted by `AuthAuditService` and flow through the Winston logger pipeline. Each entry is a JSON object on a single log line.

### Log format

```json
{
  "level": "warn",
  "message": "[AUDIT] AUTH_TOKEN_REUSE_DETECTED",
  "context": "AuthAuditService",
  "event": "AUTH_TOKEN_REUSE_DETECTED",
  "userId": 42,
  "email": null,
  "ipAddress": "203.0.113.5",
  "userAgent": "Mozilla/5.0 ...",
  "timestamp": "2026-04-22T10:00:00.000Z"
}
```

### Event catalogue

| Event | Level | Trigger |
|---|---|---|
| `AUTH_LOGIN_SUCCESS` | INFO | Successful email/password login |
| `AUTH_LOGOUT` | INFO | User called `/auth/logout` |
| `AUTH_TOKEN_REFRESHED` | INFO | Successful token rotation |
| `AUTH_WALLET_LOGIN_SUCCESS` | INFO | Successful wallet login |
| `AUTH_REGISTER_SUCCESS` | INFO | New user registered |
| `AUTH_LOGIN_FAILED` | WARN | Wrong password or unknown email |
| `AUTH_LOGIN_SUSPENDED` | WARN | Login attempt by suspended user |
| `AUTH_TOKEN_REUSE_DETECTED` | WARN | Revoked refresh token presented again |
| `AUTH_TOKEN_REFRESH_FAILED` | WARN | Expired or invalid refresh token |
| `AUTH_WALLET_LOGIN_FAILED` | WARN | Unknown address/chain combination |

### Searching logs

```bash
# All security events in the last hour (jq + journald example)
journalctl -u tycoon-api --since "1 hour ago" -o json \
  | jq 'select(.message | test("AUTH_(LOGIN_FAILED|TOKEN_REUSE|LOGIN_SUSPENDED)"))'

# Count by event type
grep '\[AUDIT\]' app.log | jq -r '.event' | sort | uniq -c | sort -rn
```

---

## 6. Database — refresh_tokens Table

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `tokenHash` | VARCHAR | SHA-256 of the raw JWT; never store the raw token |
| `userId` | INT | FK → `users.id` (CASCADE DELETE) |
| `expiresAt` | TIMESTAMP | Set at creation; checked on every refresh |
| `isRevoked` | BOOLEAN | `true` after rotation or logout |
| `createdAt` | TIMESTAMP | Auto-set |
| `lastUsedAt` | TIMESTAMP | Updated on each successful refresh |
| `ipAddress` | VARCHAR(45) | IPv4 or IPv6 of the client |
| `userAgent` | TEXT | Browser/client identifier |

**Housekeeping — purge expired tokens (run weekly via cron or migration):**

```sql
DELETE FROM refresh_tokens
WHERE "expiresAt" < NOW() - INTERVAL '1 day'
  AND "isRevoked" = true;
```

> Keep revoked-but-not-yet-expired tokens for 24 h to support audit queries.

---

## 7. Monitoring & Alerting

### Recommended alert rules

| Alert | Condition | Severity | Action |
|---|---|---|---|
| Token reuse spike | `AUTH_TOKEN_REUSE_DETECTED` > 5 in 5 min | P1 | Page on-call; investigate account compromise |
| Login failure spike | `AUTH_LOGIN_FAILED` > 50 in 1 min from single IP | P2 | Block IP at WAF; notify security |
| Suspended login spike | `AUTH_LOGIN_SUSPENDED` > 10 in 10 min | P3 | Review suspension list; check for automation |
| Refresh failure spike | `AUTH_TOKEN_REFRESH_FAILED` > 100 in 5 min | P2 | Check clock skew; check token lifetime config |

### Grafana dashboard queries (Loki / log-based)

```logql
# Token reuse rate (per minute)
sum(rate({app="tycoon-api"} |= "AUTH_TOKEN_REUSE_DETECTED" [1m]))

# Login failure rate
sum(rate({app="tycoon-api"} |= "AUTH_LOGIN_FAILED" [1m]))
```

---

## 8. Rollback Procedure

The SW-BE-003/004/005/006 changes are fully backward-compatible. No schema changes were introduced in SW-BE-004/005/006.

**If a rollback is needed:**

1. Revert the deployment to the previous image tag.
2. No database migration revert is required for SW-BE-004/005/006.
3. For SW-BE-003 (token hashing migration), revert requires:
   ```bash
   npm run migration:revert
   ```
   This restores the `token` column. All existing sessions will be invalidated — users must re-authenticate.

---

## 9. Migration Notes

| Batch item | Schema change | Migration file | Revert safe? |
|---|---|---|---|
| SW-BE-003 | `token` → `tokenHash`; added `lastUsedAt`, `ipAddress`, `userAgent` | `1740520000000-UpdateRefreshTokensForSecurity.ts` | Yes — `migration:revert` |
| SW-BE-004 | None | — | N/A |
| SW-BE-005 | None | — | N/A |
| SW-BE-006 | None | — | N/A |

**Pre-deploy checklist (all environments):**

- [ ] `JWT_SECRET` is set and not the default placeholder value
- [ ] `JWT_EXPIRES_IN` and `JWT_REFRESH_EXPIRES_IN` match expected values
- [ ] `JWT_CLOCK_SKEW_SECONDS` is set (default 60 is fine)
- [ ] NTP is synchronised on all app servers
- [ ] Auth unit tests pass: `npx jest --testPathPatterns="auth" --no-coverage`
- [ ] Audit log pipeline (Winston → your log aggregator) is receiving events

---

*Last updated: SW-BE-006 · Stellar Wave batch*
