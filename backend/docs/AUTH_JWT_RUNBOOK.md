# AUTH JWT RUNBOOK

Operational runbook for Tycoon session authentication. This document is the
source of truth for how access tokens, refresh tokens, and CSRF protection are
issued, rotated, and revoked across the frontend (Next.js 16 / React 19),
backend (NestJS 11), and shop-api (NestJS purchases SoT).

Related documents:

- `frontend/docs/ADR-004-session-tokens-httpOnly-cookies.md` — session token
  storage decision (httpOnly cookies).
- `frontend/CSP_DOCUMENTATION.md` — Content Security Policy and cookie flags.
- `TOKEN_REFRESH_SECURITY_GUIDE.md` — refresh rotation and reuse detection.
- `NEAR_WALLET_TESTNET_CHECKLIST.md` — wallet signature verification checklist.

## 1. Token model

| Token         | Storage                          | Lifetime | Notes |
| ------------- | -------------------------------- | -------- | ----- |
| Access token  | httpOnly `Secure` `SameSite=Lax` cookie | 15 min | Never exposed to JS. |
| Refresh token | httpOnly `Secure` `SameSite=Strict` cookie, path-scoped to `/auth/refresh` | 30 days | Rotated on every use. |
| CSRF token    | Non-httpOnly cookie + `X-CSRF-Token` header | session | Double-submit pattern. |

Per ADR-004, **JS-readable access tokens are banned**. Do not return access or
refresh tokens in JSON response bodies, do not persist them in `localStorage`,
`sessionStorage`, or in-memory stores that survive a reload, and do not log
them. The API client must rely on the browser to attach cookies
(`credentials: 'include'`).

## 2. Cookie flags

All auth cookies MUST be set with:

- `HttpOnly` — inaccessible to JavaScript.
- `Secure` — TLS only (enforced in staging and production).
- `SameSite=Lax` for the access token; `SameSite=Strict` for the refresh token.
- `Path=/` for the access token; `Path=/auth/refresh` for the refresh token.
- `Domain` scoped to the API host; never a wildcard parent domain.

## 3. Challenge / nonce flow (NEAR wallet)

1. Client calls `POST /auth/challenge` with the wallet `account_id`.
2. Server generates a cryptographically random nonce, stores it with a short
   TTL (default 5 minutes) keyed by `account_id`, and returns the challenge
   message. Challenges are throttled per `account_id` and per IP.
3. Client signs the challenge with the NEAR wallet. The signed payload MUST be
   domain-separated (include the API origin and a fixed prefix) and MUST bind
   the `account_id`.
4. Client calls `POST /auth/verify` with `account_id`, `public_key`,
   `signature`, and the nonce.
5. Server verifies the signature against the bound `account_id`, checks the
   nonce is present and unexpired, then **deletes the nonce** before issuing
   tokens. A replayed nonce MUST fail closed.

Signature verification failures (bad signature, mismatched `account_id`,
unknown or expired nonce, oversized payload) return `401` and are counted in
rate-limit buckets. Never echo the nonce or signature back in error bodies.

## 4. Refresh / rotation flow

1. Client calls `POST /auth/refresh`; the browser sends the refresh cookie.
2. Server validates the refresh token, checks it is not revoked, and issues a
   new access token plus a new refresh token (rotation).
3. The consumed refresh token is marked used. If a used token is presented
   again, treat it as **reuse detection**: revoke the entire refresh family for
   that session and force re-authentication.
4. Parallel refreshes from the same client are serialized server-side; the
   losing request receives `409` and the client retries once with the new
   cookie. Clients MUST NOT fan out concurrent refresh calls.

## 5. CSRF strategy

Cookie-authenticated mutations require CSRF protection:

- On session start, the server sets a non-httpOnly `csrf_token` cookie.
- The API client reads that cookie and sends it as `X-CSRF-Token` on every
  `POST`, `PUT`, `PATCH`, and `DELETE` request.
- The server compares the header against the cookie (double-submit) and rejects
  mismatches with `403`.
- `GET`/`HEAD`/`OPTIONS` are exempt but MUST NOT mutate state.
- Requests with `Origin`/`Referer` outside the allowlist are rejected even if
  the CSRF token matches.

## 6. Redirect allowlist (`returnTo`)

Any `returnTo` / `redirect` parameter MUST be validated against an explicit
allowlist of same-origin paths. Reject absolute URLs, protocol-relative URLs
(`//evil.example`), and encoded variants. On failure, fall back to the default
post-login route rather than reflecting the supplied value. This prevents open
redirects during login and refresh flows.

## 7. WebSocket handshake

The WS handshake MUST parse the same httpOnly access cookie as REST. Do not
accept tokens via query string. Unauthenticated or expired handshakes are
closed with `4401`; forbidden roles are closed with `4403`. Deny by default for
any new WS action surface.

## 8. CSP `connect-src` allowlist (NEAR wallet and API hosts)

The Content Security Policy `connect-src` directive is deny-by-default. Only
the following origins may be contacted by `fetch`, `XMLHttpRequest`, WebSocket,
and `EventSource` from the frontend. Everything else is blocked by the browser.

| Origin | Purpose |
| ------ | ------- |
| `'self'` | Same-origin backend and Next.js routes. |
| `https://rpc.testnet.near.org` | NEAR testnet RPC (read-only chain queries). |
| `https://rpc.mainnet.near.org` | NEAR mainnet RPC (gated behind readiness issue). |
| `https://helper.testnet.near.org` | NEAR testnet wallet helper. |
| `https://helper.mainnet.near.org` | NEAR mainnet wallet helper. |
| `https://wallet.testnet.near.org` | NEAR testnet wallet UI. |
| `https://wallet.mainnet.near.org` | NEAR mainnet wallet UI. |
| `https://api.tycoon.example` | Backend (NestJS 11) API origin. |
| `https://shop-api.tycoon.example` | shop-api (purchases SoT) origin. |
| `wss://api.tycoon.example` | Authenticated WebSocket endpoint (same cookie parsing as REST). |

Rules:

- No wildcard hosts (`*.near.org`, `https://*`) in `connect-src`.
- No `http:` origins in staging or production; TLS only.
- Stellar/Soroban RPC hosts are **not** allowlisted until Stellar is gated
  ready per ADR-003. Do not add them speculatively.
- Any new host requires a PR that updates both this runbook and
  `frontend/CSP_DOCUMENTATION.md`; the two documents MUST stay consistent.
- `connect-src` violations are reported via `report-to`/`report-uri`; reports
  MUST NOT include tokens, nonces, or PII.

## 9. Failure modes

- **Dependency outage (Postgres/Redis/shop-api/RPC):** fail closed on writes.
  Do not issue tokens if the nonce store or session store is unavailable.
- **Auth expiry mid-flow:** return `401`; the client attempts a single refresh,
  then redirects to login.
- **Forbidden role access:** return `403`; never leak resource existence.
- **Adversarial input:** reject oversized payloads, enumeration attempts, and
  spoofed events; rate-limit every external entrypoint touched here.

## 10. Logging and secrets

- Never log access tokens, refresh tokens, nonces, signatures, or CSRF tokens.
- Redact tokens in error traces and telemetry labels; avoid PII in labels.
- No secrets in the repository.

## 11. Verification checklist

- [ ] Access and refresh tokens are httpOnly, `Secure`, and correctly
      `SameSite`-scoped; no JS-readable access tokens anywhere.
- [ ] Challenge nonces are single-use, TTL-bound, and throttled.
- [ ] Refresh rotation revokes the family on reuse detection.
- [ ] CSRF double-submit enforced on all cookie-authenticated mutations.
- [ ] `returnTo` redirects are allowlisted.
- [ ] WS handshake uses the same cookie parsing as REST.
- [ ] CSP `connect-src` allowlists only the NEAR wallet/RPC, backend, and
      shop-api origins above; no wildcards; consistent with
      `frontend/CSP_DOCUMENTATION.md`.
- [ ] `auth-token-security.e2e`, `auth.e2e`, signature-verify unit negatives,
      and the frontend RTL wallet-reject path are green.
