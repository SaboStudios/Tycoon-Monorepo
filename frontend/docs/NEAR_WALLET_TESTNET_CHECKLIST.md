# NEAR wallet — testnet manual checklist

Prerequisites: `NEXT_PUBLIC_NEAR_NETWORK=testnet` (default). Optional: `NEXT_PUBLIC_NEAR_CONTRACT_ID` if your app uses a contract other than the default testnet sign-in contract.

## End-to-end testnet proof: NEAR login → create/join → finish → claim

Run this flow on testnet before every release that touches auth, matchmaking, or the
Soroban/NEAR boundary. It is the acceptance path for issue #1809.

1. **Login (challenge/nonce)** — Open the app, click **Connect NEAR**, pick MyNearWallet
   (or another enabled wallet), complete sign-in. The backend must issue a single-use
   challenge/nonce bound to the requested `account_id`; the wallet signs the
   domain-separated message. Expect the header to show a truncated account id.
   - Reject the signature once: expect a toast with *transaction was not signed; connect
     and approve to continue* and **no** session cookie set.
   - Replay the same signed nonce: expect rejection (nonce already consumed) and no session.
2. **Session cookie** — After a successful login, confirm the session is carried by an
   `httpOnly`, `Secure`, `SameSite` cookie (ADR-004). No access token may be readable from
   JS (`document.cookie` must not expose it).
3. **Account** — Hover or long-press the account pill; full account id should appear in the
   tooltip (`title`).
4. **Create / join** — Create a game, then join it from a second wallet/session. Expect the
   server to be the source of truth for the game state; duplicate create/join requests
   (double-click, reconnect retry) must be idempotent and not create extra games.
5. **Finish** — Play the game to completion. Expect the finish transition to be authorized
   for the participating accounts only; a non-participant or expired session must be
   rejected (fail-closed on writes).
6. **Claim** — Claim the reward. Expect the claim to be authorized, idempotent, and to
   reject replayed claims. Confirm the balance/inventory reflects the claim exactly once.
7. **Refresh / rotation** — Let the session expire mid-flow and refresh. Expect a silent
   rotation via the refresh cookie; a replayed refresh token must revoke the refresh family
   and force re-login (TOKEN_REFRESH_SECURITY_GUIDE).
8. **CSRF & redirects** — Cookie-authenticated mutations must require the CSRF token; a
   mutation without it must be rejected. A `returnTo`/redirect pointing off the allowlist
   must be refused (no open redirect).
9. **Disconnect** — Click **Disconnect NEAR**; account pill disappears, session cookie is
   cleared, and **Connect NEAR** returns.
10. **Pending → confirmed** — Submit a valid contract call. Expect **Transaction pending…**,
    then **Confirmed**, and a **View on explorer** link.
11. **Explorer link** — Open the link; NEAR Explorer should show the transaction hash on testnet.
12. **Mobile** — Open the bottom menu; NEAR block should appear at the bottom of the sheet
    with **Connect NEAR** / account + disconnect.

## Auth, session, and telemetry security (SW-FE-005/039)

Run these after the wallet flow above passes. They verify the auth/session hardening required by ADR-004, AUTH_JWT_RUNBOOK, and TOKEN_REFRESH_SECURITY_GUIDE. Do not mark the checklist complete until every item passes on testnet.

### Challenge / nonce issuance

13. **Challenge issued** — Trigger sign-in. The backend must issue a single-use challenge/nonce bound to the requested `account_id` before any signature is accepted. Confirm the challenge is domain-separated (network + contract id + origin are part of the signed payload) so a signature for one domain cannot be replayed against another.
14. **Replayed nonce rejected** — Re-submit the exact same signed challenge a second time. Expect a 4xx rejection (nonce already consumed) and no new session cookie. The challenge must be invalidated on first use.
15. **Forged account rejected** — Sign a challenge with a different key than the one controlling the claimed `account_id`. Expect rejection; no session is created. A forged account session must be impossible.
16. **Challenge throttling** — Request challenges in a tight loop for the same account/IP. Expect rate limiting (429 or equivalent) rather than unbounded issuance.

### Cookie / token handling (ADR-004)

17. **httpOnly session cookie** — After a successful sign-in, inspect `document.cookie` and application storage. No access token or refresh token may be readable from JS. The session must live in an `httpOnly`, `Secure`, `SameSite` cookie.
18. **No JS-readable tokens** — Confirm no access/refresh token is persisted in `localStorage`, `sessionStorage`, or a non-httpOnly cookie. Any JS-readable access token is a failure.
19. **Refresh rotation** — Let the access token expire and trigger a refresh. Expect a rotated refresh token; the previous refresh token must no longer work.
20. **Reuse detection revokes family** — Replay a previously used refresh token. Expect the whole refresh family to be revoked and the session to be terminated (re-login required).
21. **Parallel refresh** — Fire two refreshes concurrently. Expect exactly one to succeed and the session to remain valid; no token desync or duplicate session.

### CSRF and redirects

22. **CSRF on cookie mutations** — Issue a cookie-authenticated mutation (e.g. a state-changing POST) without the CSRF token/header. Expect rejection. With the correct CSRF token, the same request succeeds.
23. **returnTo allowlist** — Attempt sign-in with `returnTo` pointing to an external origin (open-redirect attempt). Expect the redirect to be rejected or clamped to an allowlisted same-origin path. Only allowlisted redirects are permitted.

### WebSocket handshake

24. **WS auth parity** — Open the authenticated WebSocket. The handshake must parse the same session cookie as REST. An unauthenticated or expired-cookie handshake must be rejected (deny-by-default).
25. **Auth expiry mid-flow** — Expire the session while a WS connection is open. Expect the connection to be closed/denied on the next authorized action rather than silently continuing.

### Telemetry and secrets

26. **No secrets in telemetry** — Inspect emitted telemetry/logs for the flows above. No tokens, cookies, signatures, or PII may appear in labels or payloads; tokens must be redacted.
27. **Fail-closed on dependency outage** — With Postgres/Redis/RPC unavailable, state-changing auth writes must fail closed (no session issued) rather than degrade to an unauthenticated success.

### Automated coverage

28. **e2e green** — `auth-token-security.e2e` and `auth.e2e` pass, including the forged-account, replayed-nonce, parallel-refresh, and open-redirect cases.
29. **Unit negatives** — Signature-verify unit tests cover the negative cases (wrong domain, wrong account binding, replayed nonce).
30. **Frontend RTL** — The wallet-reject path is covered by a React Testing Library test asserting the reject toast and that no session is established.

## Mobile NEAR wallet bottom-sheet automation notes

Automate the mobile bottom-sheet NEAR block (step 12) so the checklist is enforced in CI
rather than by hand. These notes are the source of truth for the automation; keep them in
sync with the RTL specs and the e2e suite named in the test plan.

### Selectors (stable test hooks)

- Bottom-sheet trigger: `data-testid="mobile-bottom-sheet-trigger"`.
- Sheet container: `data-testid="mobile-bottom-sheet"`.
- NEAR block (must be the last child of the sheet): `data-testid="mobile-near-block"`.
- Connect button: `data-testid="mobile-near-connect"`.
- Account pill: `data-testid="mobile-near-account"` (full account id in `title`).
- Disconnect button: `data-testid="mobile-near-disconnect"`.

### RTL coverage (wallet reject path)

- Open the sheet, assert `mobile-near-block` is the last child of `mobile-bottom-sheet`.
- Click `mobile-near-connect`, reject the signature in the mocked wallet, and assert the
  reject toast (*transaction was not signed; connect and approve to continue*) renders and
  that no session cookie is set (`document.cookie` does not expose an access token).
- Assert the account pill shows the truncated id and exposes the full id via `title`.
- Click `mobile-near-disconnect` and assert the pill is removed and `mobile-near-connect`
  returns.

### e2e coverage

- `auth.e2e`: challenge/nonce issuance, single-use consumption, and replay rejection.
- `auth-token-security.e2e`: httpOnly/Secure/SameSite cookie, no JS-readable access token,
  refresh rotation, and reuse detection revoking the refresh family.
- Mobile viewport run: bottom-sheet NEAR block placement, connect/disconnect, and the
  reject path above.

### Failure modes to verify

- Dependency outage (Postgres/Redis/shop-api/RPC): writes fail closed, no partial state.
- Forbidden role access: admin/WS/action surfaces deny by default.
- Oversized or adversarial payloads: rejected without leaking tokens or PII in logs.
- Concurrent duplicate requests / reconnect retries: idempotent, no duplicate games or claims.
- Auth expiry mid-flow: silent rotation, or forced re-login on reuse detection.
- Open redirect attempts: `returnTo` off the allowlist is refused.
