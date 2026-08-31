# Security Policy

## Reporting vulnerabilities

Please do not open a public GitHub issue for critical or sensitive security findings.

Instead, report them privately via one of the following channels:

- Email: security@tycoon.example (replace with the project’s real private disclosure address when it is configured)
- GitHub Security Advisory: https://github.com/SaboStudios/Tycoon-Monorepo/security/advisories/new

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

## Response target

We aim to acknowledge high-priority reports within 5 business days and to provide a remediation timeline after triage. Exact SLAs may vary by severity and report quality.

## Related guidance

- `backend/docs/TOKEN_REFRESH_SECURITY_GUIDE.md`
- `backend/docs/AUTH_JWT_RUNBOOK.md`
- `backend/docs/CORS_SECURITY_GUIDE.md`
- `backend/docs/ADR-001-shop-purchase-ownership.md`
