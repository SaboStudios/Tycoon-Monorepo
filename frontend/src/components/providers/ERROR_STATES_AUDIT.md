# Error & Empty States Audit for providers/ Components

> Scope: `frontend/src/components/providers/` — Issue #770

## Overview

This document audits all providers for error and empty states, documents the patterns
applied, and records the acceptance criteria for each provider.

---

## Provider Breakdown

| Provider | Async | Error State Before | Error State After | Empty State |
|----------|-------|--------------------|-------------------|-------------|
| `auth-provider` | Yes (refresh, logout) | ❌ None exposed | ✅ `error` + `clearError` | N/A — `user: null` is the empty state |
| `near-wallet-provider` | Yes (wallet init) | ✅ `initError` already present | ✅ No change needed | `accountId: null` is the empty state |
| `theme-provider` | No | N/A | N/A | N/A |
| `toast-provider` | No | N/A | N/A | N/A |
| `analytics-provider` | No | N/A | N/A | N/A |
| `i18n-provider` | No | N/A | N/A | N/A |
| `msw-provider` | No | N/A | N/A | N/A |
| `pwa-provider` | No (SW registration) | ✅ Graceful catch already | ✅ No change needed | N/A |
| `route-focus-provider` | No | N/A | N/A | N/A |

---

## Detailed Analysis

### auth-provider — Changes Applied

**Before**: `AuthContextType` had no `error` field. Failures in `login()` threw synchronously
and failures in `refreshSession()` were silently caught (only logged to console). Consumers
had no way to surface a user-visible error state.

**After**: Added `error: string | null` and `clearError: () => void` to `AuthContextType`.

- `login()` — sets `error` when token decoding fails, then re-throws (existing callers unaffected).
- `refreshSession()` — captures the caught error message into `error` before delegating to `logout()`.
- `clearError()` — lets UI consumers (e.g., a login form) dismiss the error banner.
- Successful `login()` calls clear any prior error.

**Empty state**: `user === null` with `loading === false` is the defined empty/unauthenticated state.

### near-wallet-provider — No Changes Needed

`initError: string | null` was already implemented. The `ready` flag distinguishes the loading
state from an error state. Consumers should branch on `initError !== null` to show an error UI.

**Empty state**: `accountId === null` with `ready === true` means the wallet is ready but no
account is connected (expected default state — not an error).

### pwa-provider — No Changes Needed

SW registration failure is already caught in the `.catch()` handler which resets both
`registration` and `isUpdateReady` to their default (no-banner) state. Users simply see no
banner — appropriate since PWA features are progressive enhancements.

---

## Error State Patterns

| Pattern | When to use |
|---------|-------------|
| `error: string \| null` in context | Provider owns async work with user-visible failure (auth, wallet) |
| `initError: string \| null` | Provider initializes a third-party SDK that can fail at startup |
| Silent catch + default state | Progressive enhancement features (PWA, MSW, analytics) |
| Throw + re-throw | Errors that callers must handle (login mutation) |

---

## Acceptance Criteria (Issue #770)

- [x] `AuthContext` exposes `error` and `clearError` so consumers can show and dismiss error banners.
- [x] `refreshSession` failure captured into `error` (not silently swallowed).
- [x] Successful login clears any previous error.
- [x] `NearWalletProvider` `initError` already met; no regression.
- [x] All changes covered by unit tests in `__tests__/providers.test.tsx`.

---

**Last Updated**: 2026-06-25  
**Components Audited**: auth-provider, near-wallet-provider, theme-provider, toast-provider,
analytics-provider, i18n-provider, msw-provider, pwa-provider, route-focus-provider
