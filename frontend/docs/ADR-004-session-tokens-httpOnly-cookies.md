# ADR-004 — Session tokens move off localStorage toward httpOnly cookies

**Status:** Proposed  
**Date:** 2026-08-31  
**Issue:** #1535

---

## Context

The frontend still reads JWT access tokens from `localStorage` and also keeps refresh tokens in JS-readable state. This creates a direct XSS blast radius: if any script runs in the browser, it can exfiltrate the bearer token and impersonate the user.

The backend already documents the token refresh flow in `backend/docs/TOKEN_REFRESH_SECURITY_GUIDE.md` and recommends moving browser storage away from client-readable sources. The current auth-provider and API client still have compatibility fallbacks that keep the older pattern alive.

## Decision

1. Access tokens and refresh tokens will not remain in `localStorage` or `sessionStorage` for production usage.
2. The browser will rely on `httpOnly`, `Secure`, and `SameSite`-guarded cookies for session-bearing state whenever the backend supports them.
3. Any remaining transitional read path must be explicitly marked as temporary and not used for long-lived session storage.
4. Frontend auth code will implement a CSRF strategy for cookie-backed state-changing requests.
5. The app will support a short migration period with compatibility reads only while the backend ships the `httpOnly` cookie flow.

## Consequences

- Client-side JavaScript can no longer read tokens directly from storage, reducing XSS impact.
- The backend must issue and validate cookie-based session state and refresh tokens.
- The application must include CSRF defenses for non-idempotent requests.
- Legacy localStorage compatibility reads should be removed once the migration is complete.

## Security notes

- `httpOnly` cookies prevent JavaScript from reading the token value.
- `Secure` ensures transmission only over HTTPS.
- `SameSite=Lax` or `Strict` reduces cross-site request risk.
- CSRF tokens or a same-site-first strategy should be used for authenticated mutations.

## Implementation checklist

- [ ] backend issues secure `httpOnly` refresh/session cookies
- [ ] frontend stops writing access or refresh tokens to `localStorage`
- [ ] API layer reads from cookie-backed sessions instead of JS-readable storage
- [ ] CSRF plan documented and implemented for mutation requests
- [ ] `TOKEN_REFRESH_SECURITY_GUIDE.md` updated to reflect the new storage model

## Related

- `backend/docs/TOKEN_REFRESH_SECURITY_GUIDE.md`
- `frontend/src/components/providers/auth-provider.tsx`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/session.ts`
