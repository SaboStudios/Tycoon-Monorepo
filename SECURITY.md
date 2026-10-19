# Security Policy

## Reporting vulnerabilities

Please do not open a public GitHub issue for critical or sensitive security findings.

Instead, use the private reporting channel:

**[Open a GitHub Security Advisory](https://github.com/SaboStudios/Tycoon-Monorepo/security/advisories/new)**

This is the only supported disclosure channel. It is private to the reporter
and the maintainers, creates a tracked advisory with a CVE path, and needs no
mailbox to be provisioned. Reports sent anywhere else may not be seen.

Maintainers: if a monitored security mailbox is later provisioned, add it here
as a second channel. Do not list an address that is not actually monitored —
a disclosure sent to an unread inbox is worse than no channel at all.

Include:

- affected package or area (`frontend/`, `backend/`, `shop-api/`, `contract/`)
- reproduction steps or proof of concept
- impact assessment and severity
- any suggested mitigations or temporary workarounds

## Scope

This policy covers:

- `frontend/` browser code and client-side auth flows
- `backend/` API, middleware, JWT handling, and refresh-token logic
- `shop-api/` purchase flow and idempotency protections
- `contract/` Rust/Soroban code and deployment pipeline

## Security expectations

- Do not disclose critical findings publicly before a fix is available.
- Prefer a private report and coordinated remediation.
- Report suspected JWT, token refresh, auth bypass, CORS, or data-exposure issues immediately.

## Response targets

Business days, measured from when the advisory is submitted. Severity is set by
the maintainers at triage and may be revised as impact becomes clearer.

| Severity | Examples | Acknowledge | Triage | Fix target |
| --- | --- | --- | --- | --- |
| Critical | Auth bypass, JWT forgery, contract fund loss, RCE | 1 day | 2 days | 7 days |
| High | Privilege escalation, purchase/idempotency bypass, PII exposure | 2 days | 5 days | 30 days |
| Medium | CORS or CSP weakness, rate-limit bypass, stored XSS behind auth | 5 days | 10 days | 90 days |
| Low | Missing hardening header, verbose errors, defence-in-depth gaps | 10 days | 20 days | Next release |

If a target is going to be missed, the maintainers update the advisory with the
reason and a revised date rather than letting it lapse silently.

Please allow 90 days before public disclosure, or until a fix ships if sooner.
We will credit reporters in the advisory unless anonymity is requested.

## Related guidance

- `backend/docs/TOKEN_REFRESH_SECURITY_GUIDE.md`
- `backend/docs/AUTH_JWT_RUNBOOK.md`
- `backend/docs/CORS_SECURITY_GUIDE.md`
- `backend/docs/ADR-001-shop-purchase-ownership.md`
