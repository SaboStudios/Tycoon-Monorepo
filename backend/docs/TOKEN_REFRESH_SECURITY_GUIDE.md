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

# NEAR wallet challenge/nonce hardening (SW-FE-005/039)

NEAR_CHALLENGE_TTL_SECONDS=300
NEAR_CHALLENGE_MAX_PER_WINDOW=10
NEAR_CHALLENGE_WINDOW_SECONDS=60
NEAR_AUTH_DOMAIN=tycoon.example
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

The frontend must n
NEAR_CHALLENGE_TTL_SECONDS=300
NEAR_CHALLENGE_MAX_PER_WINDOW=10
NEAR_CHALLENGE_WINDOW_SECONDS=60
NEAR_AUTH_DOMAIN=tycoon.example
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
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/';
  }
  if (value.includes('\\')) return '/';
  const normalized = new URL(value, 'https://tycoon.example').pathname;
  const allowed = ALLOWED_RETURN_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`),
  );
  return allowed ? normalized : '/';
}
```

Rules:

- Only same-origin, path-relative targets are accepted.
- Absolute (`https://evil.com`), protocol-relative (`//evil.com`), and
  backslash-smuggled (`/\evil.com`) values fall back to `/`.
- The allowlist is deny-by-default: new destinations must be added explicitly.

## NEAR Wallet Challenge / Nonce Hardening (SW-FE-033)

The NEAR wallet login flow issues a server-generated challenge (nonce) that the
wallet signs. The signature is verified server-side with domain separation and
bound to the `account_id`; challenges are single-use and throttled.

### Challenge issuance

- The server generates a cryptographically random nonce and stores it with a
  TTL (`NEAR_CHALLENGE_TTL_SECONDS`, default 300s).
- The challenge message is domain-separated using `NEAR_AUTH_DOMAIN` so a
  signature produced for one origin cannot be replayed against another.
- Challenges are single-use: a nonce is consumed on first verification attempt
  and rejected thereafter (replayed nonce => `401`).
- Issuance is throttled per account/IP
  (`NEAR_CHALLENGE_MAX_PER_WINDOW` per `NEAR_CHALLENGE_WINDOW_SECONDS`).

```typescript
// Domain-separated challenge message
const message = [
  `${config.NEAR_AUTH_DOMAIN} wants you to sign in with your NEAR account:`,
  accountId,
  `Nonce: ${nonce}`,
  `Issued At: ${issuedAt}`,
].join('\n');
```

### Signature verification

- Verify the NEAR signature against the public key registered for the claimed
  `account_id`; reject if the account does not own the key.
- Bind the verified `account_id` into the issued session — never trust a
  client-supplied account id without a matching signature.
- Fail-closed: any verification error (bad signature, expired/consumed nonce,
  unknown account) rejects the login and issues no tokens.
- A user rejecting the wallet signature is a normal negative path: no session is
  created and no tokens are issued.

```typescript
// Verification contract (fail-closed)
const challenge = await this.consumeChallenge(nonce); // single-use
if (!challenge || challenge.expiresAt < now) {
  throw new UnauthorizedException('Challenge expired or already used');
}
const ok = verifySignature({
  message: challenge.message,
  signature,
  publicKey,
  accountId: challenge.accountId,
});
if (!ok) throw new UnauthorizedException('Invalid NEAR signature');
```

### Failure modes

- **Replayed nonce** — consumed nonce is rejected; no tokens issued.
- **User rejects sign** — no challenge consumption side effects beyond TTL
  expiry; the client may request a fresh challenge.
- **Parallel refresh** — serialize refreshes client-side; the server's rotation
  rule revokes the family on a raced reuse.
- **Open redirect attempts** — `returnTo` is validated by `safeReturnTo` above.
- **Forged account session** — the signature is bound to `account_id` and the
  domain-separated message, so a signature for one account/origin cannot mint a
  session for another.

## Troubleshooting

### "Token reuse detected" errors

This means a refresh token was used more than once. Common causes:

1. **Parallel refresh requests** — the client fired multiple refreshes at once.
   Serialize refreshes so only one is in flight.
2. **Stale token after rotation** — the client kept using an old token. Always
   store the newest token returned by the refresh response.
3. **Token theft** — an attacker replayed a stolen token. The family is revoked
   and the user must re-authenticate.

### Users logged out unexpectedly

If reuse detection fires spuriously, check for parallel refresh races and ensure
clients persist the rotated token before issuing the next request.

### Cookies not being set

- Confirm `AUTH_COOKIE_SECURE` matches the transport (TLS in prod).
- Confirm `AUTH_COOKIE_DOMAIN` covers the API host.
- Confirm the client sends `credentials: 'include'`.

### CSRF 403 on mutations

- Ensure the `CSRF_COOKIE_NAME` cookie is present and echoed in
  `CSRF_HEADER_NAME`.
- The CSRF cookie is intentionally not httpOnly so the client can read it.
