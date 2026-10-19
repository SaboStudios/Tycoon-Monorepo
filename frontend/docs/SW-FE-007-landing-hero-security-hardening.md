# SW-FE-007 — Landing Hero: Security Hardening Review

This change is part of the Stellar Wave frontend batch and performs a security hardening review of the Landing Hero section.

## Scope

### CSP (Content Security Policy) Review
- CSP headers are already configured in `next.config.ts` with:
  - `default-src 'self'`
  - `script-src 'self' 'nonce-{nonce}'`
  - `style-src 'self' 'nonce-{nonce}'`
  - `img-src 'self' data: https:`
  - `font-src 'self' data:`
  - `connect-src 'self' https://api.example.com`
  - `frame-ancestors 'none'`
  - `base-uri 'self'`
  - `form-action 'self'`
- Nonce generation in `middleware.ts` uses `crypto.getRandomValues()` (cryptographically secure)
- CSP runs in report-only mode in development, enforced in production

### XSS Prevention
- All user-facing text in `HeroSection` is hardcoded (no dynamic user input rendered)
- Error messages are sanitized via `sanitizeError()` from `@/lib/errors` — never exposes stack traces or PII
- SVG paths use static `d` attributes — no dynamic content injection
- All `onClick` handlers use `useCallback` for stable references

### Security Headers (already configured)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Additional Hardening Applied
- Navigation failures are caught and sanitized — no raw error objects exposed to the DOM
- `sanitizeError` strips PII, stack traces, and sensitive data before display
- Error state uses `role="alert"` for proper screen reader announcements
- All decorative elements have `aria-hidden="true"` to prevent information leakage via accessibility tree

## Files Changed

| File | Change |
|------|--------|
| `src/components/guest/HeroSection.tsx` | **Updated** — added error sanitization, `useCallback` for handlers |
| `frontend/CSP_DOCUMENTATION.md` | **Reviewed** — no changes needed, CSP is properly configured |
| `frontend/next.config.ts` | **Reviewed** — security headers are properly configured |
| `frontend/src/middleware.ts` | **Reviewed** — nonce generation is cryptographically secure |

## Feature Flag Plan

No runtime flag is added. Security hardening is always active.

## Migration Notes

- No API changes.
- No schema/data migration.
- No user action required.
- CSP documentation is already in place at `CSP_DOCUMENTATION.md`.

## Verification Checklist

- [x] CSP headers reviewed and confirmed
- [x] Nonce generation uses `crypto.getRandomValues()`
- [x] Error messages sanitized (no stack traces, no PII)
- [x] XSS vectors reviewed (no dynamic content injection)
- [x] Security headers confirmed (X-Frame-Options, X-Content-Type-Options, etc.)
- [x] `npm run typecheck`
- [x] PR references Stellar Wave and SW-FE-007
