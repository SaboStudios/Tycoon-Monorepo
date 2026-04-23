# SW-FE-033 — NEAR Wallet Connect: Accessibility & Focus Order

Part of the **Stellar Wave** engineering batch.

## Problem

The `NearWalletConnect` component had several accessibility gaps that made it
unusable or confusing for screen-reader and keyboard-only users:

| Element | Issue |
|---------|-------|
| `initError` span | No `role="alert"` — errors were never announced by screen readers |
| Account badge span | No `aria-label` — AT read the truncated visual string (e.g. `"very-lo…ount"`) instead of the full account id |
| Disconnect button | No `aria-label` — AT announced only `"Disconnect NEAR"` with no indication of *which* account |
| Transaction status div | No `aria-live` region — phase changes (pending → confirmed / failed) were invisible to AT |
| `<Wallet>`, `<Loader2>`, `<ExternalLink>` icons | Not `aria-hidden` — decorative SVGs were exposed to the accessibility tree as unlabelled images |

## Changes

| File | Change |
|------|--------|
| `src/components/wallet/NearWalletConnect.tsx` | Added `role="alert"` to `initError`; `aria-label="Connected as {accountId}"` to account badge; `aria-label="Disconnect NEAR wallet {accountId}"` to disconnect button; `aria-hidden="true"` to all decorative icons; `aria-live="polite"` + `aria-atomic="true"` to the transaction status wrapper. |
| `test/NearWalletConnect.test.tsx` | Added 5 accessibility regression tests (see below). |

### Component diff summary

```tsx
// initError — was: plain <span>
<span role="alert" ...>{initError}</span>

// Account badge — was: no aria-label
<span aria-label={`Connected as ${accountId}`} ...>
  <Wallet aria-hidden="true" ... />
  <span aria-hidden="true">{truncateAccount(accountId)}</span>
</span>

// Disconnect button — was: no aria-label
<button aria-label={`Disconnect NEAR wallet ${accountId}`} ...>

// Connect button icon — was: no aria-hidden
<Wallet aria-hidden="true" ... />

// Transaction status wrapper — was: plain div, no live region
<div aria-live="polite" aria-atomic="true" ...>

// Spinner — was: no aria-hidden
<Loader2 aria-hidden="true" ... />

// Explorer link icon — was: no aria-hidden
<ExternalLink aria-hidden="true" ... />
```

## New tests

```
✓ initError has role=alert so screen readers announce it immediately
✓ account badge has aria-label with full account id
✓ disconnect button aria-label includes the account id
✓ transaction status wrapper has aria-live=polite
✓ transaction status wrapper has aria-atomic=true
```

## No new dependencies

All changes are pure HTML attribute additions. No new packages, no bundle impact.

## Feature flag / rollout

No runtime flag needed. Changes are additive ARIA attributes only — no visual
or behavioural change for sighted users.

1. Deploy to preview.
2. Test with VoiceOver (macOS) or NVDA (Windows):
   - Trigger a wallet init error — confirm it is announced immediately.
   - Connect a wallet — confirm badge reads the full account id.
   - Click Disconnect — confirm the button label includes the account id.
   - Submit a transaction — confirm pending/confirmed/failed announcements.
3. Promote to production once no regressions are observed.

**Rollback**: revert this single commit. No data migration required.

## Verification checklist

```bash
cd frontend
npm run typecheck
npm run test
```

Manual:
- [ ] Screen reader announces `initError` without user interaction
- [ ] Account badge reads full account id (not truncated)
- [ ] Disconnect button label identifies the account being disconnected
- [ ] Transaction phase changes are announced via live region
- [ ] No decorative icons appear in the AT tree

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-033
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 5 new accessibility regression cases
- [x] No new production dependencies
- [x] All decorative icons are `aria-hidden`
- [x] Error and status regions use appropriate ARIA live/alert roles
- [x] Interactive elements have descriptive labels
