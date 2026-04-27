# SW-FE-033 — NEAR Wallet Connect: Accessibility & Focus Order

**Issue:** #538 · Stellar Wave · Frontend  
**Scope:** `frontend/src/components/wallet/NearWalletConnect.tsx`

## Changes

### `NearWalletConnect.tsx`

| Element | Before | After |
|---|---|---|
| Init-error banner | plain `<span>` | `role="alert"` — announced immediately by screen readers |
| Connect button | no explicit label | `aria-label="Connect NEAR wallet"` |
| Disconnect button | no explicit label | `aria-label="Disconnect NEAR wallet (accountId)"` — includes account for context |
| Decorative icons (`Wallet`, `Loader2`, `ExternalLink`) | no attribute | `aria-hidden="true"` — hidden from AT, prevents duplicate announcements |
| Transaction status wrapper | no live region | `aria-live="polite" aria-atomic="true"` — announces tx state changes without interrupting |

Focus order is unchanged; the DOM order already matches the visual order (error → connect/disconnect → tx status), so no reordering was needed.

### `src/lib/near/telemetry.ts` (bug fix)

Corrected a broken relative import `./client` → `../analytics/client`. The file did not exist at the old path, causing all tests that transitively import `near-wallet-provider` to fail at module resolution.

## Tests

8 new accessibility assertions added to `test/NearWalletConnect.test.tsx` in a dedicated `NearWalletConnect — accessibility` describe block:

- Connect button has `aria-label`
- Disconnect button `aria-label` includes account id
- `initError` renders with `role="alert"`
- No `role="alert"` when `initError` is null
- Transaction status region has `aria-live="polite"` and `aria-atomic="true"`
- Decorative `Wallet` icon inside connect button is `aria-hidden`
- Decorative `Loader2` icon during pending tx is `aria-hidden`
- `ExternalLink` icon inside explorer link is `aria-hidden`

## Rollout / Feature Flag / Migration

No feature flag required. Changes are purely additive ARIA attributes — no visual or behavioural change. Safe to ship directly.

No migration steps needed for consumers of `NearWalletConnect`; the component API (`className`, `variant`) is unchanged.

## CI

- `npm run test` — 205/205 tests pass across 22 test files ✓
- `npm run typecheck` — no new type errors ✓
