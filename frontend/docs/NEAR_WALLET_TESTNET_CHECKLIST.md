# NEAR wallet — testnet manual checklist

Prerequisites: `NEXT_PUBLIC_NEAR_NETWORK=testnet` (default). Optional: `NEXT_PUBLIC_NEAR_CONTRACT_ID` if your app uses a contract other than the default testnet sign-in contract.

1. **Connect** — Open the app, click **Connect NEAR**, pick MyNearWallet (or another enabled wallet), complete sign-in. Expect the header to show a truncated account id.
2. **Account** — Hover or long-press the account pill; full account id should appear in the tooltip (`title`).
3. **Disconnect** — Click **Disconnect NEAR**; account pill disappears and **Connect NEAR** returns.
4. **Reject signature** — From client code or a flow that calls `callContractMethod`, cancel the wallet prompt. Expect a toast with: transaction was not signed; connect and approve to continue.
5. **Pending → confirmed** — Submit a valid contract call. Expect **Transaction pending…**, then **Confirmed**, and a **View on explorer** link.
6. **Explorer link** — Open the link; NEAR Explorer should show the transaction hash on testnet.
7. **Mobile** — Open the bottom menu; NEAR block should appear at the bottom of the sheet with **Connect NEAR** / account + disconnect.

## Auth, session, and telemetry security (SW-FE-005/039)

Run these after the wallet flow above passes. They verify the auth/session hardening required by ADR-004, AUTH_JWT_RUNBOOK, and TOKEN_REFRESH_SECURITY_GUIDE. Do not mark the checklist complete until every item passes on testnet.

### Challenge / nonce issuance

8. **Challenge issued** — Trigger sign-in. The backend must issue a single-use challenge/nonce bound to the requested `account_id` before any signature is accepted. Confirm the challenge is domain-separated (network + contract id + origin are part of the signed payload) so a signature for one domain cannot be replayed against another.
9. **Replayed nonce rejected** — Re-submit the exact same signed challenge a second time. Expect a 4xx rejection (nonce already consumed) and no new session cookie. The challenge must be invalidated on first use.
10. **Forged account rejected** — Sign a challenge with a different key than the one controlling the claimed `account_id`. Expect rejection; no session is created. A forged account session must be impossible.
11. **Challenge throttling** — Request challenges in a tight loop for the same account/IP. Expect rate limiting (429 or equivalent) rather than unbounded issuance.

### Cookie / token handling (ADR-004)

12. **httpOnly session cookie** — After a successful sign-in, inspect `document.cookie` and application storage. No access token or refresh token may be readable from JS. The session must live in an `httpOnly`, `Secure`, `SameSite` cookie.
13. **No JS-readable tokens** — Confirm no access/refresh token is persisted in `localStorage`, `sessionStorage`, or a non-httpOnly cookie. Any JS-readable access token is a failure.
14. **Refresh rotation** — Let the access token expire and trigger a refresh. Expect a rotated refresh token; the previous refresh token must no longer work.
15. **Reuse detection revokes family** — Replay a previously used refresh token. Expect the whole refresh family to be revoked and the session to be terminated (re-login required).
16. **Parallel refresh** — Fire two refreshes concurrently. Expect exactly one to succeed and the session to remain valid; no token desync or duplicate session.

### CSRF and redirects

17. **CSRF on cookie mutations** — Issue a cookie-authenticated mutation (e.g. a state-changing POST) without the CSRF token/header. Expect rejection. With the correct CSRF token, the same request succeeds.
18. **returnTo allowlist** — Attempt sign-in with `returnTo` pointing to an external origin (open-redirect attempt). Expect the redirect to be rejected or clamped to an allowlisted same-origin path. Only allowlisted redirects are permitted.

### WebSocket handshake

19. **WS auth parity** — Open the authenticated WebSocket. The handshake must parse the same session cookie as REST. An unauthenticated or expired-cookie handshake must be rejected (deny-by-default).
20. **Auth expiry mid-flow** — Expire the session while a WS connection is open. Expect the connection to be closed/denied on the next authorized action rather than silently continuing.

### Telemetry and secrets

21. **No secrets in telemetry** — Inspect emitted telemetry/logs for the flows above. No tokens, cookies, signatures, or PII may appear in labels or payloads; tokens must be redacted.
22. **Fail-closed on dependency outage** — With Postgres/Redis/RPC unavailable, state-changing auth writes must fail closed (no session issued) rather than degrade to an unauthenticated success.

### Automated coverage

23. **e2e green** — `auth-token-security.e2e` and `auth.e2e` pass, including the forged-account, replayed-nonce, parallel-refresh, and open-redirect cases.
24. **Unit negatives** — Signature-verify unit tests cover the negative cases (wrong domain, wrong account binding, replayed nonce).
25. **Frontend RTL** — The wallet-reject path is covered by a React Testing Library test asserting the reject toast and that no session is established.
