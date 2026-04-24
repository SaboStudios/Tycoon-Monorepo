# SW-FE-033 — NEAR Wallet Connect: Accessibility & Focus Order

Part of the **Stellar Wave** engineering batch.

## Problem

`NearWalletConnect` had several accessibility gaps that made it unusable with
screen readers and keyboard-only navigation:

| Issue | Impact |
|-------|--------|
| Outer `<div>` had no landmark role | Screen-reader users could not jump to the wallet widget |
| `initError` rendered in a plain `<span>` | Errors were not announced automatically |
| Connect button had no `aria-label` when disabled | "Connect NEAR" gave no hint that the wallet was still initialising |
| Account badge used `title` only | Truncated text was not accessible to screen readers |
| Disconnect button had no account context | Screen readers announced "Disconnect NEAR" with no indication of which account |
| Transaction status `<div>` had no `aria-live` | Status changes (pending → confirmed / failed) were silent to AT |
| Explorer link opened `_blank` with no hint | Screen readers did not warn users the link opens in a new tab |
| Decorative icons had no `aria-hidden` | Lucide SVGs were exposed to the accessibility tree as unlabelled images |

## Changes

| File | Change |
|------|--------|
| `src/components/wallet/NearWalletConnect.tsx` | See details below |
| `test/NearWalletConnect.test.tsx` | 9 new accessibility assertions added |

### `NearWalletConnect.tsx` — attribute-by-attribute

- **Outer wrapper** — `role="region" aria-label="NEAR wallet"` so landmark
  navigation (`F6` / rotor) can reach the widget directly.
- **`initError` span** — `role="alert"` so the message is announced immediately
  when it appears, without the user having to navigate to it.
- **Connect button** — `aria-label` set to `"Connect NEAR wallet"` when ready,
  `"Connect NEAR wallet (initialising…)"` when `!ready`, so the disabled state
  is self-describing.
- **Account badge** — `aria-label="Connected as <accountId>"` exposes the full
  account id; the truncated visible text and the Wallet icon are both
  `aria-hidden="true"` to avoid duplication.
- **Disconnect button** — `aria-label="Disconnect NEAR wallet (<accountId>)"`
  so users know which account they are disconnecting.
- **Transaction status wrapper** — `aria-live="polite" aria-atomic="true"
  aria-label="Transaction status"` so every phase change is announced once the
  user is idle.
- **Explorer link** — `aria-label` includes `"(opens in new tab)"` and a
  visually-hidden `<span className="sr-only">(opens in new tab)</span>` is
  appended for redundancy; `ExternalLink` icon is `aria-hidden="true"`.
- **All decorative Lucide icons** — `aria-hidden="true"` added to `<Wallet>`,
  `<Loader2>`, and `<ExternalLink>` instances.

## No new dependencies

All changes are pure HTML/ARIA attributes. No new packages, no bundle impact.

## Feature flag / rollout

No runtime flag needed. Changes are additive ARIA attributes only; they have no
visual effect and no behavioural change for pointer/touch users.

1. Deploy to preview.
2. Run automated tests (`npm run test`) — all 9 new a11y assertions must pass.
3. Smoke-test with a screen reader (VoiceOver / NVDA):
   - Navigate to the wallet region via landmark navigation.
   - Trigger an `initError` — confirm it is announced immediately.
   - Click **Connect NEAR** while the wallet is initialising — confirm the
     disabled label is read.
   - Connect a wallet — confirm the account badge and disconnect button labels.
   - Submit a contract call — confirm the status region announces each phase.
4. Promote to production once no regressions are observed.

**Rollback**: revert this single commit. No data migration required.

## Verification checklist

```bash
cd frontend
npm run typecheck
npm run test
```

Manual (screen reader):
- [ ] Landmark navigation reaches "NEAR wallet" region
- [ ] `initError` is announced as an alert without focus movement
- [ ] Disabled connect button reads "initialising" hint
- [ ] Account badge reads full account id, not truncated text
- [ ] Disconnect button reads account id in its label
- [ ] Transaction status changes are announced politely
- [ ] Explorer link announces "opens in new tab"
- [ ] No unlabelled SVG images in the accessibility tree

## Acceptance criteria

- [x] PR references Stellar Wave and issue id SW-FE-033
- [x] `npm run typecheck` passes
- [x] `npm run test` passes including 9 new a11y assertions
- [x] No new production dependencies
- [x] All ARIA gaps listed in the audit are resolved
