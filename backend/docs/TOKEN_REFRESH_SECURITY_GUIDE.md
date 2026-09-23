# Token Refresh Security - Developer Guide

## Quick Start

### Running the Migration

Before using the new security features, run the database migration:

```bash
npm run migration:run
```

This will:
- Update the `refresh_tokens` table schema
- Add metadata tracking columns
- Clear existing tokens (users will need to re-authenticate)

### Environment Configuration

Add to your `.env` file:

```bash
# Optional: Clock skew tolerance (default: 60 seconds)
JWT_CLOCK_SKEW_SECONDS=60

# Cookie transport (ADR-004). Access/refresh tokens are delivered as
# httpOnly Secure SameSite cookies and are never exposed to JavaScript.
AUTH_COOKIE_DOMAIN=.tycoon.example
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAMESITE=strict
AUTH_ACCESS_COOKIE_NAME=tycoon_at
AUTH_REFRESH_COOKIE_NAME=tycoon_rt

# CSRF double-submit secret for cookie-authenticated mutations
CSRF_COOKIE_NAME=tycoon_csrf
CSRF_HEADER_NAME=x-csrf-token
```

## Key Changes for Developers

### 1. Token Storage

**Before:**
```typescript
// Tokens stored in plaintext
token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**After:**
```typescript
// Tokens stored as SHA-256 hashes
tokenHash: "ebd917958fc7b45aa35d972f7babc2331c0776a2aed01a6d54f799d0407735"
```

### 1a. Client Session Storage Direction

The frontend must not keep long-lived access tokens in `localStorage` or any JS-readable browser storage. Session material should move to server-issued `httpOnly` cookies for the refresh path, with the browser only receiving a short-lived cookie-backed session or an opaque session identifier.

**Recommended direction:**

```text
localStorage or sessionStorage -> deprecated
httpOnly secure cookies -> preferred
SameSite=Lax or Strict for browser navigation + CSRF mitigation
CSRF token for state-changing cross-site requests
```

**Current transitional status:** the repo still has a compatibility shim in the frontend auth-provider and API client for older flows, but the long-term target is zero JS-readable token storage.

### 2. Token Creation

The `createRefreshToken` method now:
- Returns an object with `{ token, entity }` instead of just the entity
- Accepts optional `ipAddress` and `userAgent` parameters
- Generates unique tokens using JWT ID (jti)
- Assigns a `familyId` so every rotation in a session shares one refresh family

**Usage:**
```typescript
const { token, entity } = await authService.createRefreshToken(
  userId,
  '192.168.1.1',  // optional
  'Mozilla/5.0'    // optional
);

// Use token for response
return { refreshToken: token };
```

### 3. Token Refresh

The `refreshTokens` method now:
- Accepts optional `ipAddress` and `userAgent` parameters
- Implements reuse detection
- Logs security events

**Usage:**
```typescript
const result = await authService.refreshTokens(
  refreshToken,
  req.ip,                      // optional
  req.headers['user-agent']    // optional
);
```

### 4. CSRF and cookie handling

If refresh or session tokens are delivered through cookies, implement a double-submit or same-site policy alongside the cookie flow. A browser cookie alone is not sufficient protection for cross-site state changing requests.

Recommended defaults:

- `Secure` on production cookies
- `SameSite=Lax` for read-only sessions and `SameSite=Strict` when the app can tolerate it
- `httpOnly` on the token cookie so it is not readable from JavaScript
- CSRF token for POST / PATCH / DELETE requests that mutate state

### 5. Security Events

Monitor logs for token reuse detection:

```typescript
// Log format
[AuthService] Refresh token reuse detected for user 123. Revoking all tokens.
```

## Refresh Token Rotation & Reuse Detection (ADR-004)

### Rotation model

Every successful refresh rotates the refresh token: the presented token is
marked `revokedAt` and a brand-new token is issued in the same `familyId`.
The access token is short-lived (default 15m) and is never persisted.

```typescript
// Pseudocode of the rotation contract
const current = await this.findByHash(hash(token));
if (!current || current.expiresAt < now) throw new UnauthorizedException();

if (current.revokedAt) {
  // Reuse of an already-rotated token => the family is compromised.
  await this.revokeFamily(current.familyId);
  this.logger.warn(`Refresh token reuse detected for user ${current.userId}. Revoking family ${current.familyId}.`);
  throw new UnauthorizedException('Token reuse detected');
}

await this.revoke(current.id);
const next = await this.createRefreshToken(current.userId, ip, ua, current.familyId);
```

### Reuse detection semantics

- A token that has already been rotated (non-null `revokedAt`) is a reuse.
- On reuse, **the entire refresh family is revoked**, not just the presented
  token. This forces re-authentication and invalidates any sibling tokens an
  attacker may hold.
- Reuse detection is fail-closed: if the family revocation write fails, the
  refresh request is rejected rather than issuing new tokens.
- Parallel refresh races are handled by the same rule: the first request wins,
  the second sees a revoked token and triggers family revocation. Clients must
  serialize refreshes (see Troubleshooting).

### Family revocation

```typescript
async revokeFamily(familyId: string): Promise<void> {
  await this.refreshTokenRepo.update(
    { familyId },
    { revokedAt: new Date() },
  );
}
```

## httpOnly Cookie Transport (ADR-004)

Access and refresh tokens are delivered exclusively via httpOnly cookies.
JavaScript-readable access tokens are banned.

- `httpOnly: true` — tokens are unreachable from `document.cookie`.
- `secure: true` — cookies only travel over TLS (disabled only in local dev).
- `sameSite: 'strict'` — mitigates cross-site request forgery for the cookie
  itself; combined with the CSRF token below for mutations.
- `path: '/'` for the access cookie, `path: '/api/v1/auth'` for the refresh
  cookie so it is only sent to the refresh/logout endpoints.

```typescript
res.cookie(ACCESS_COOKIE, accessToken, {
  httpOnly: true,
  secure: config.AUTH_COOKIE_SECURE,
  sameSite: config.AUTH_COOKIE_SAMESITE,
  domain: config.AUTH_COOKIE_DOMAIN,
  path: '/',
  maxAge: ACCESS_TTL_MS,
});

res.cookie(REFRESH_COOKIE, refreshToken, {
  httpOnly: true,
  secure: config.AUTH_COOKIE_SECURE,
  sameSite: config.AUTH_COOKIE_SAMESITE,
  domain: config.AUTH_COOKIE_DOMAIN,
  path: '/api/v1/auth',
  maxAge: REFRESH_TTL_MS,
});
```

**Never** return tokens in the JSON body, and never store them in
`localStorage`/`sessionStorage`. The frontend must rely on the cookie and call
`/api/v1/auth/refresh` with `credentials: 'include'`.

## CSRF Strategy for Cookie-Authenticated Mutations

Because auth now rides on cookies, state-changing requests need CSRF defense:

1. On login/refresh, issue a non-httpOnly `CSRF_COOKIE_NAME` cookie containing a
   random token bound to the session.
2. Clients echo it in the `CSRF_HEADER_NAME` header on every mutating request
   (`POST`/`PUT`/`PATCH`/`DELETE`).
3. The server compares the header against the cookie (double-submit) and
   rejects mismatches with `403 Forbidden`.
4. `SameSite=strict` is the second layer; do not rely on it alone.

```typescript
// Guard sketch
if (isMutating(req.method)) {
  const cookieToken = req.cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];
  if (!cookieToken || cookieToken !== headerToken) {
    throw new ForbiddenException('Invalid CSRF token');
  }
}
```

## Redirect Allowlisting

`returnTo` / post-login redirect targets must be validated against an
allowlist. Reject absolute URLs and protocol-relative (`//evil.com`) values to
prevent open redirects.

```typescript
const ALLOWED_RETURN_PREFIXES = ['/', '/games', '/shop', '/profile'];

function safeReturnTo(value: string | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return ALLOWED_RETURN_PREFIXES.some((p) => value === p || value.startsWith(`${p}/`))
    ? value
    : '/';
}
```

## Testing

### Running Security Tests

```bash
# Run token security integration tests
npm run test:e2e -- auth-token-security.e2e-spec.ts

# Run all auth tests
npm test -- auth.service.spec.ts
```

### Writing Tests

When testing token refresh:

```typescript
// Create a token
const { token } = await authService.createRefreshToken(userId);

// Use it once (this revokes it)
await authService.refreshTokens(token);

// Trying to use it again should fail
await expect(
  authService.refreshTokens(token)
).rejects.toThrow('Token reuse detected');
```

## Common Scenarios

### Scenario 1: Normal Token Refresh

```typescript
// Client sends refresh token via httpOnly cookie
POST /api/v1/auth/refresh
Cookie: tycoon_rt=eyJhbGc...
X-CSRF-Token: <csrf>

// Server response sets rotated cookies
Set-Cookie: tycoon_at=new-access-token; HttpOnly; Secure; SameSite=Strict
Set-Cookie: tycoon_rt=new-refresh-token; HttpOnly; Secure; SameSite=Strict
```

### Scenario 2: Token Reuse Attack

```typescript
// Attacker tries to reuse an old token
POST /api/v1/auth/refresh
Cookie: tycoon_rt=old-revoked-token

// Server response
401 Unauthorized
{
  "statusCode": 401,
  "message": "Token reuse detected"
}

// The entire refresh family is revoked
// User must re-authenticate
```

### Scenario 3: User Logout

```typescript
// User logs out
POST /api/v1/auth/logout

// All refresh tokens for this user are revoked
// Cookies are cleared
// Any subsequent refresh attempts will fail
```

## Security Best Practices

### 1. Always Pass Metadata

When calling auth service methods, always pass IP address and user agent:

```typescript
// ✅ Good
await authService.refreshTokens(
  token,
  req.ip,
  req.headers['user-agent']
);

// ❌ Bad (missing metadata)
await authService.refreshTokens(token);
```

### 2. Handle Token Reuse Errors

```typescript
try {
  const result = await authService.refreshTokens(token);
  return result;
} catch (error) {
  if (error.message === 'Token reuse detected') {
    // Log security event
    logger.warn('Potential security breach detected');
    
    // Force user to re-authenticate
    throw new UnauthorizedException('Please log in again');
  }
  throw error;
}
```

### 3. Monitor Token Metrics

Track these metrics in production:
- Token refresh rate
- Token reuse detection frequency
- Failed refresh attempts
- Token lifetime distribution

### 4. Clock Synchronization

Ensure server clocks are synchronized:
- Use NTP (Network Time Protocol)
- Monitor clock drift
- Adjust `JWT_CLOCK_SKEW_SECONDS` if needed

### 5. Never Log Tokens

Tokens, cookie values, and CSRF secrets must never appear in logs or
telemetry labels. Redact `Cookie`, `Set-Cookie`, and `Authorization` headers in
request logging.

## Troubleshooting

### Issue: "Token reuse detected" on legitimate requests

**Possible Causes:**
1. Client is caching old tokens
2. Multiple requests using the same token
3. Race condition in token refresh

**Solutions:**
1. Ensure client updates stored token after each refresh
2. Implement request queuing on client side
3. Add retry logic with exponential backoff

### Issue: "Invalid refresh token" errors

**Possible Causes:**
1. Token expired
2. Token was revoked (logout)
3. Database migration cleared tokens

**Solutions:**
1. Check token expiration time
2. Verify user hasn't logged out
3. Prompt user to re-authenticate

### Issue: Clock skew errors

**Possible Causes:**
1. Server clocks out of sync
2. `JWT_CLOCK_SKEW_SECONDS` too low

**Solutions:**
1. Synchronize server clocks with NTP
2. Increase clock skew tolerance
3. Monitor server time drift

### Issue: 403 "Invalid CSRF token"

**Possible Causes:**
1. Client not echoing the CSRF header
2. CSRF cookie missing after refresh

**Solutions:**
1. Send `CSRF_HEADER_NAME` on all mutating requests
2. Re-issue the CSRF cookie on login/refresh

## API Reference

### AuthService Methods

#### `createRefreshToken(userId, ipAddress?, userAgent?, familyId?)`

Creates a new refresh token with metadata.

**Parameters:**
- `userId` (number): User ID
- `ipAddress` (string, optional): Client IP address
- `userAgent` (string, optional): Client user agent
- `familyId` (string, optional): Existing refresh family to continue

**Returns:**
```typescript
{
  token: string;      // The actual JWT token
  entity: RefreshToken;  // Database entity
}
```

#### `refreshTokens(token, ipAddress?, userAgent?)`

Refreshes access and refresh tokens.

**Parameters:**
- `token` (string): Current refresh token
- `ipAddress` (string, optional): Client IP address
- `userAgent` (string, optional): Client user agent

**Returns:**
```typescript
{
  accessToken: string;
  refreshToken: string;
}
```

**Throws:**
- `UnauthorizedException`: Invalid, expired, or reused token

#### `revokeFamily(familyId)`

Revokes every refresh token in a family. Called on reuse detection.

**Parameters:**
- `familyId` (string): Refresh family identifier

**Returns:** `Promise<void>`

#### `logout(userId)`

Revokes all refresh tokens for a user.

**Parameters:**
- `userId` (number): User ID

**Returns:** `Promise<void>`

## Migration Guide

### For Existing Applications

1. **Backup Database**
   ```bash
   pg_dump your_database > backup.sql
   ```

2. **Run Migration**
   ```bash
   npm run migration:run
   ```

3. **Update Environment**
   ```bash
   echo "JWT_CLOCK_SKEW_SECONDS=60" >> .env
   ```

4. **Notify Users**
   - All users will need to re-authenticate
   - Existing refresh tokens are invalidated

5. **Monitor Logs**
   - Watch for "Token reuse detected" warnings
   - Track authentication failures

6. **Rollback Plan**
   ```bash
   npm run migration:revert
   ```

## Additional Resources

- [Implementation Documentation](../TOKEN_REFRESH_SECURITY_IMPLEMENTATION.md)
- [Integration Tests](../test/auth-token-security.e2e-spec.ts)
- [ADR-004: Session Tokens via httpOnly Cookies](../../frontend/docs/ADR-004-session-tokens-httpOnly-cookies.md)
- [OWASP JWT Security](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
