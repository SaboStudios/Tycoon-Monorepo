# Token Refresh Security Guide

This guide defines how Tycoon issues, refreshes, and revokes session credentials across the
frontend (Next.js 16 / React 19), backend (NestJS 11), and shop-api (NestJS purchases SoT).
It is the source of truth for the session httpOnly cookie + CSRF work tracked in issue #1729
and must be read together with `frontend/docs/ADR-004-session-tokens-httpOnly-cookies.md` and
`AUTH_JWT_RUNBOOK.md`.

## 1. Token model

- **Access token**: short-lived JWT (default 15 minutes). Never exposed to JavaScript.
- **Refresh token**: opaque, high-entropy (>= 256 bits), single-use, rotated on every refresh.
- **Session binding**: every refresh token is bound to a `session_id` and a `family_id`.
- **Storage**: both tokens are delivered only as cookies (see section 2). No token is ever
  returned in a JSON body, `localStorage`, `sessionStorage`, or any JS-readable location.

## 2. Cookie policy (ADR-004)

All session cookies MUST be set with:

| Attribute  | Value                                                        |
| ---------- | ------------------------------------------------------------ |
| `HttpOnly` | `true` — JS-readable access tokens are banned                |
| `Secure`   | `true` in every non-local environment                        |
| `SameSite` | `Lax` for the session cookie, `Strict` for the CSRF cookie   |
| `Path`     | `/` for the session cookie, `/` for the CSRF cookie          |
| `Domain`   | unset (host-only) unless a documented cross-subdomain need   |
| `Max-Age`  | access `900`, refresh `604800` (7 days)                      |

Cookie names:

- `tycoon_at` — access token (httpOnly, Secure, SameSite=Lax)
- `tycoon_rt` — refresh token (httpOnly, Secure, SameSite=Lax, Path=`/api/auth`)
- `tycoon_csrf` — CSRF token (readable by JS, Secure, SameSite=Strict)

`tycoon_rt` is scoped to `/api/auth` so it is only sent to refresh/logout endpoints.

## 3. CSRF strategy for cookie-authenticated mutations

Because cookies are attached automatically by the browser, every state-changing request must
prove it originated from the Tycoon origin.

1. On login (and on refresh), the server issues a random `tycoon_csrf` cookie and returns the
   same value in the `X-CSRF-Token` response header.
2. The frontend api client reads `tycoon_csrf` and echoes it in the `X-CSRF-Token` request
   header for every `POST`, `PUT`, `PATCH`, and `DELETE`.
3. The backend rejects any cookie-authenticated mutation whose `X-CSRF-Token` header is
   missing or does not match the `tycoon_csrf` cookie with `403 CSRF_TOKEN_INVALID`.
4. `GET`/`HEAD`/`OPTIONS` are exempt but MUST NOT mutate state.
5. The CSRF token is rotated whenever the session is refreshed or the user re-authenticates.

Double-submit alone is not sufficient for privileged admin routes: those additionally require
an `Origin`/`Referer` allowlist check (section 5).

## 4. Refresh and rotation flow

1. Client calls `POST /api/auth/refresh` with credentials included; the browser sends
   `tycoon_rt` and `tycoon_csrf`.
2. Server validates the refresh token, checks it is unused and unexpired, and verifies the
   CSRF header matches the cookie.
3. Server rotates: the presented refresh token is marked consumed and a new one is issued in
   the same `family_id`.
4. Server issues a new access token and a new CSRF token; both cookies are re-set.
5. **Reuse detection**: if a refresh token that was already consumed is presented, the entire
   `family_id` is revoked immediately, all sessions in the family are invalidated, and a
   `refresh_reuse_detected` security event is emitted (no token values in the event).
6. **Parallel refresh**: concurrent refreshes for the same token are serialized server-side.
   The first wins; the losers receive `409 REFRESH_IN_PROGRESS` and must retry with the new
   cookie. The client must not treat `409` as a logout.

Refresh tokens are single-use. There is no grace window that allows a consumed token to be
replayed.

## 5. Redirect allowlist (`returnTo`)

`returnTo` (and any equivalent post-auth redirect parameter) MUST be validated against an
allowlist before use:

- Only relative paths beginning with a single `/` are accepted.
- Protocol-relative (`//evil.com`), absolute (`https://evil.com`), and backslash (`/\evil.com`)
  values are rejected and replaced with the default landing route.
- Encoded traversal (`%2f%2f`, `%5c`) is decoded once and re-validated.
- Rejections are logged as `open_redirect_blocked` without the raw value.

## 6. WebSocket handshake auth

The WS gateway MUST parse the same `tycoon_at` cookie as REST. Handshake auth rules:

- Read the access token from the cookie; do not accept tokens from query strings or the
  first WS message.
- Validate the JWT signature, expiry, and `session_id` exactly as REST does.
- Reject the handshake with `4401` when the token is missing, expired, or revoked.
- Re-check authorization on every privileged message; a valid handshake is not a standing
  grant.

## 7. NEAR signature verification

- Challenges are domain-separated: the signed payload includes the Tycoon domain, the
  `account_id`, a random nonce, and an issued-at timestamp.
- The `account_id` is bound to the challenge and to the resulting session; a signature valid
  for one account cannot be replayed for another.
- Nonces are single-use and expire (default 5 minutes). Replayed nonces are rejected with
  `401 NONCE_REPLAYED`.
- Challenge issuance is throttled per IP and per `account_id` to prevent enumeration and
  brute force.
- A user rejecting the wallet signature results in `401 SIGNATURE_REJECTED`; the client shows
  a retry affordance and does not create a session.

## 8. Failure modes and fail-closed behavior

- **Dependency outage** (Postgres, Redis, shop-api, RPC): writes fail closed. Reads may serve
  cached data only when explicitly documented; auth and money paths never do.
- **Auth expiry mid-flow**: the api client attempts a single refresh, then retries the original
  request once. If refresh fails, the user is redirected to login and in-flight mutations are
  abandoned.
- **Forbidden role access**: `403` with a generic message; no role or resource enumeration.
- **Idempotency**: mutating endpoints accept an idempotency key so duplicate requests and
  reconnect retries do not double-apply.
- **Oversized payloads**: rejected at the edge with `413` before reaching handlers.

## 9. Logging and telemetry

- Never log access tokens, refresh tokens, CSRF tokens, signatures, or raw cookies.
- Redact `Authorization`, `Cookie`, and `Set-Cookie` headers in all logs.
- Security events (`refresh_reuse_detected`, `open_redirect_blocked`, `nonce_replayed`,
  `csrf_rejected`) carry identifiers only, never token values or PII.

## 10. Checklist

- [ ] Access and refresh tokens are httpOnly, Secure, SameSite cookies only.
- [ ] No JS-readable access token anywhere in the frontend or api client.
- [ ] CSRF token issued, echoed on mutations, and verified server-side.
- [ ] Refresh rotation with reuse detection revokes the whole family.
- [ ] Parallel refresh returns `409` and is retried, not treated as logout.
- [ ] `returnTo` validated against the allowlist; open redirects blocked.
- [ ] WS handshake parses the same cookie as REST and re-authorizes per message.
- [ ] NEAR challenges are domain-separated, account-bound, throttled, and nonce-protected.
- [ ] Writes fail closed on dependency outage.
- [ ] No secrets or PII in logs or telemetry.
