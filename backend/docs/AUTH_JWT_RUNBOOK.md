# AUTH JWT Runbook

Operational runbook for Tycoon authentication: JWT access/refresh tokens, refresh
rotation with reuse detection, httpOnly cookie transport (ADR-004), CSRF, and
NEAR wallet challenge/nonce verification. This runbook also documents the
**cookie/header parsing parity** required by issue #1801 so that the
GamesGateway handshake accepts exactly the same credentials as the REST JWT
strategy.

Sources of truth:

- `backend/docs/TOKEN_REFRESH_SECURITY_GUIDE.md`
- `backend/docs/ADR-002-games-realtime-transport.md`
- `frontend/docs/ADR-004-session-tokens-httpOnly-cookies.md`
- `frontend/docs/NEAR_WALLET_TESTNET_CHECKLIST.md`
- `frontend/docs/SW-FE-005-near-wallet-telemetry.md`
- `frontend/docs/SW-FE-033-near-wallet-a11y-focus-order.md`
- `backend/test/auth-token-security.e2e-spec.ts`
- `backend/test/auth.e2e-spec.ts`

## 1. Token model

| Token   | Lifetime | Storage                          | Transport            |
| ------- | -------- | -------------------------------- | -------------------- |
| Access  | 15m      | httpOnly Secure SameSite cookie  | `Set-Cookie`         |
| Refresh | 30d      | httpOnly Secure SameSite cookie  | `Set-Cookie`         |

- Access tokens are **never** exposed to JavaScript. No `localStorage`,
  `sessionStorage`, or JS-readable cookies (ADR-004).
- Cookies are `httpOnly`, `Secure`, `SameSite=Lax` (or `Strict` for admin
  surfaces), and scoped to the API origin with `Path=/`.
- The server is the source of truth for money, dice, inventory, and admin
  mutations. A valid cookie is required for every authenticated write.

## 2. Token sources (parity contract)

The REST JWT strategy and the WebSocket handshake MUST resolve the bearer token
from the same ordered list of sources. Any divergence is a bug.

Resolution order (first match wins):

1. `Authorization: Bearer <jwt>` header.
2. `access_token` cookie (httpOnly, per ADR-004).
3. `token` cookie (legacy alias, kept for parity with older clients).

Rules:

- The `Authorization` header takes precedence over cookies when both are present.
- Cookie values are URL-decoded before verification.
- Empty, whitespace-only, or malformed values are treated as *absent* and fall
  through to the next source.
- The resolved token is verified with the **same** `JwtService` / strategy
  instance used by REST. Do not duplicate verification logic in the gateway.

## 3. Refresh rotation

Every refresh call rotates the refresh token:

1. Validate the presented refresh token signature, expiry, and `jti`.
2. Look up the refresh family (`familyId`) and the token record.
3. If the token is **unused and unrevoked**, mark it used, issue a new access +
   refresh pair in the same family, and return both as httpOnly cookies.
4. If the token was **already used or revoked**, treat it as reuse (see §4).

Rotation is atomic: the used-mark and the new-token insert happen in a single
transaction so concurrent duplicate requests cannot both succeed.

## 4. Reuse detection

Reuse of a rotated refresh token means the token was stolen or replayed.

- On detection, **revoke the entire refresh family** (`familyId`), not just the
  presented token. All descendants become invalid immediately.
- Return `401 Unauthorized` and clear both auth cookies.
- Emit a security event with the `familyId` and `userId` only. Never log the
  token value, `jti`, or any PII.
- Fail closed: if the token store (Postgres/Redis) is unavailable, reject the
  refresh rather than issuing new tokens.

## 5. CSRF strategy

Cookie-authenticated mutations require CSRF protection:

- Double-submit token: a non-httpOnly `csrf` cookie paired with an
  `X-CSRF-Token` header that must match.
- `SameSite=Lax`/`Strict` cookies as defense in depth.
- Reject state-changing requests (POST/PUT/PATCH/DELETE) with a missing or
  mismatched CSRF token using `403 Forbidden`.
- Safe methods (GET/HEAD/OPTIONS) are exempt.

## 6. NEAR wallet challenge / nonce

- Issue a single-use, time-boxed challenge nonce per login attempt.
- Verify the NEAR signature with domain separation and bind the `account_id`
  into the signed payload.
- Throttle challenge issuance per IP and per account to prevent enumeration.
- Reject replayed nonces; a nonce is consumed on first successful verify.
- If the user rejects the signature, no session is created and the nonce is
  discarded.

### 6.1 Domain-separated signed payload

The signed message MUST be constructed from a canonical, domain-separated
envelope so a signature produced for one purpose cannot be replayed against
another. The `account_id` is bound into the payload and re-checked server-side
against the account that requested the nonce.

```
<domain>\n<account_id>\n<nonce>\n<issued_at>\n<expires_at>
```

- `<domain>` is a fixed, versioned constant (e.g. `tycoon.near.login.v1`).
  Changing it invalidates all outstanding challenges.
- `<account_id>` is the NEAR account that requested the challenge. A signature
  whose embedded `account_id` differs from the requesting account is rejected.
- `<nonce>` is a cryptographically random, single-use value.
- `<issued_at>` / `<expires_at>` are Unix seconds; challenges are short-lived
  (default 5 minutes) and rejected once expired.

Verification steps (all must pass, deny-by-default):

1. Look up the challenge by `nonce`; reject if unknown, expired, or consumed.
2. Recompute the canonical payload from the stored challenge fields; never trust
   client-supplied `account_id`, `issued_at`, or `expires_at`.
3. Verify the NEAR signature against the public key registered for the bound
   `account_id`.
4. On success, consume the nonce (single-use) and issue the session cookies.
5. On any failure, return `401 Unauthorized` and do **not** create a session.

### 6.2 Challenge throttling

- Rate-limit challenge issuance per IP **and** per `account_id`.
- Exceeding the limit returns `429 Too Many Requests` with `Retry-After`.
- Throttling is fail-closed: if the rate-limit store (Redis) is unavailable,
  reject new challenge issuance rather than allowing unbounded requests.

### 6.3 Telemetry (SW-FE-005)

- Emit challenge issued / verified / rejected counters with outcome labels only.
- Never include the nonce, signature, public key, or `account_id` in telemetry
  labels or logs; use coarse outcome enums to avoid PII and enumeration leaks.

### 6.4 Wallet a11y focus order (SW-FE-033)

The NEAR wallet connect / sign flow is keyboard- and screen-reader-operable. The
focus order below is the contract the frontend implements; the backend must not
introduce steps that break it (e.g. silent redirects or auto-submitting forms).

1. **Connect wallet** trigger receives focus first.
2. On activation, focus moves to the wallet selector (or the wallet's own modal).
3. After the wallet is selected, focus moves to the **Sign** action.
4. On success, focus returns to the element that initiated the flow (the
   connect trigger) so the user is not dropped at the top of the document.
5. On rejection or error, focus moves to the inline error message, which is
   announced via `role="alert"` / `aria-live="assertive"`.

Backend implications:

- Challenge issuance and verification are **synchronous request/response**; do
  not redirect the browser mid-flow. Return JSON so the client controls focus.
- Error responses carry a stable, machine-readable `code` (see §8) so the
  frontend can map failures to the correct focus target and message.
- A rejected signature (`user rejects sign`) is a normal `401` outcome, not a
  server error, and must not create a session or consume a *different* nonce.

## 7. Redirects

- `returnTo` values are validated against an allowlist of known origins/paths.
- Reject open-redirect attempts (absolute URLs, protocol-relative `//`, and
  encoded variants) with `400 Bad Request`.

## 8. WebSocket handshake

Browsers cannot set arbitrary headers on `WebSocket`, so the cookie path is the
primary transport for browser clients. Native/CLI clients may use the
`Authorization` header.

- The gateway extracts the token during the handshake (before `connection`),
  parsing the same httpOnly auth cookies as REST.
- On success, the socket is bound to the authenticated principal and its role
  (`seat` or `spectator`).
- On failure, the handshake is rejected before upgrade. **Deny-by-default**: an
  unauthenticated socket is never admitted and never receives broadcasts.

### Stable error codes

| Code | Meaning |
| --- | --- |
| `AUTH_MISSING_TOKEN` | No token found in any source. |
| `AUTH_INVALID_TOKEN` | Token present but failed verification. |
| `AUTH_EXPIRED_TOKEN` | Token verified but is past `exp`. |
| `AUTH_FORBIDDEN_ROLE` | Authenticated but role not permitted for the action. |

These codes are part of the client contract and must remain stable.

## 9. Authorization: seat vs spectator

- `seat` principals may submit game intents (e.g. `roll`).
- `spectator` principals may observe only. Any mutating intent is rejected with
  `AUTH_FORBIDDEN_ROLE` and dropped server-side.
- The server is the source of truth for outcomes; clients submit intents, never
  results.
- Hidden information (e.g. unrevealed cards) is never broadcast to spectators.

## 10. Token expiry mid-session

- Expiry is evaluated on every inbound action, not only at handshake.
- On expiry the socket receives `AU

/* … truncated 2675 chars — edit only what you need near the top … */
