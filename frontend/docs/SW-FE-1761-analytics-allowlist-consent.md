# SW-FE-1761 — Analytics provider allowlist + consent wiring

Issue: #1761. Supersedes the provider-registry and consent sections of
SW-FE-039, SW-FE-005 and SW-FE-006 (those docs now point here).

## Rules

1. **One allowlist.** `frontend/src/lib/analytics/allowlist.ts` is the only
   list of analytics providers: `plausible`, `ga4`, `posthog`. The repo-root
   `lib/analytics/providers.ts` re-exports it, so the two cannot drift.
2. **Unknown providers fail the build.** `next.config.ts` calls
   `assertAnalyticsBuildEnv()` when Next loads the config, so `next build`
   (and `next dev`) exits with an error if `NEXT_PUBLIC_ANALYTICS_PROVIDERS`
   contains an unregistered id, or if `NEXT_PUBLIC_ENABLE_ANALYTICS` is anything
   other than `true` / `false` / unset.
3. **Deny-by-default.** Events leave the browser only when all of these hold:
   - `NEXT_PUBLIC_ENABLE_ANALYTICS` is exactly `true`;
   - at least one provider is configured (or the dev-only debug sink is on);
   - the stored consent decision is exactly `granted`.
   Missing, unreadable or tampered consent means no telemetry.
4. **PII is scrubbed twice.** `sanitizeAnalyticsPayload` keeps only the keys in
   each event's schema, drops known PII keys, and drops any value that looks
   like an email, NEAR account id, 64-char hex key, `0x…` hash, base32 public
   key, or JWT. Query strings and fragments are stripped from `route`. Strings
   over 200 characters are dropped.
5. **Runtime fails closed.** If a bad provider id reaches the browser anyway (for
   example, a preview built before this gate), `resolveAnalyticsProviders()`
   returns no providers instead of crashing the page.

## Consent

| Piece | File |
|---|---|
| Store (localStorage `tycoon.telemetry.consent` = `granted` \| `denied`) | `src/lib/analytics/consent.ts` |
| React hook (SSR-safe, syncs across tabs) | `src/hooks/useAnalyticsConsent.ts` |
| Banner, mounted in the root layout | `src/components/analytics/ConsentBanner.tsx` |
| Withdraw / reset control, on `/privacy-policy#analytics-choices` | `src/components/analytics/AnalyticsConsentSettings.tsx` |
| Gate on every event | `canTrack()` in `src/lib/analytics/client.ts` |
| Page views after consent | `src/components/providers/analytics-provider.tsx` |

The legacy consent readers keep working: the join page already reads the same
storage key, and the store mirrors the decision to `window.__tycoonConsent` for
the landing Hero sink.

### Banner behaviour

- Rendered only after hydration, only when analytics is configured, and only
  while no decision is stored. It renders nothing on the server, so there is no
  hydration mismatch and no layout shift. It is `position: fixed`, so it adds 0 CLS.
- Non-modal `region` landmark (`aria-labelledby` / `aria-describedby`). It does
  not take or trap focus. It sits after page content in the DOM, so the SW-FE-741
  order (skip link → header → main → footer) is unchanged. Inside the banner,
  Tab order is: privacy link → **Decline** → **Accept analytics**. Both buttons
  have the same visual weight and are at least 44 px tall.
- A double click is harmless: `setConsent` is idempotent, and the banner unmounts
  as soon as a decision is stored.
- Withdrawing consent takes effect on the next event, because `track()` checks
  consent on every call.

## Adding a provider

1. Add the id to `ANALYTICS_PROVIDER_IDS` in `allowlist.ts`.
2. Add a factory to `providerFactories` in `providers.ts`. The record is typed
   against the allowlist, so step 1 without step 2 is a compile error.
3. Loading the provider's script requires a CSP change (`script-src` /
   `connect-src` in `next.config.ts` and `middleware.ts`) plus security review.
   No provider script is loaded today.
4. Update this doc, `docs/ENVIRONMENT.md` and the tests in
   `test/analytics-allowlist.test.ts`.

## Operations

```bash
# Enable (preview first). An unknown id makes the build exit non-zero.
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ANALYTICS_PROVIDERS=plausible

# Kill switch: redeploy with the flag off. Nothing is sent, and the banner is hidden.
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

Debug (non-production only): set `NEXT_PUBLIC_ANALYTICS_DEBUG=true`, then read
`window.__tycoonAnalytics.events`. You must accept the banner first, because
debug events are consent-gated too.

### Rollback

This change is frontend-only and does not migrate any data. Reverting the PR
restores the previous behaviour: analytics on unless the flag is `"false"`,
and no consent check. Stored consent keys are harmless if left in place.
Operators do not need to do anything else. Note one behaviour change: the
old default (analytics on when the flag was unset) is now off. Set
`NEXT_PUBLIC_ENABLE_ANALYTICS=true` explicitly where analytics is wanted.

## Tests

| Layer | File |
|---|---|
| Allowlist, flag parsing, `next.config.ts` build gate | `test/analytics-allowlist.test.ts` |
| Consent store: tampering, storage failures, cross-tab, idempotency | `test/analytics-consent.test.ts` |
| Client gating, withdrawal, fail-closed, throwing provider | `test/analytics-client.test.ts` |
| Banner + settings (RTL: a11y names, focus order, SSR, double click) | `test/ConsentBanner.test.tsx` |
| Page views only after consent | `test/AnalyticsProvider.test.tsx` |
| Value scrubbing | `src/lib/analytics/taxonomy.test.ts` |
| Root shim parity | `lib/analytics/providers.test.ts` |
| Playwright: no beacons pre-consent, banner keyboard path, withdrawal | `e2e/analytics-consent.spec.ts` |

```bash
cd frontend
npx vitest run test/analytics-allowlist.test.ts test/analytics-consent.test.ts \
  test/analytics-client.test.ts test/ConsentBanner.test.tsx \
  test/AnalyticsProvider.test.tsx src/lib/analytics/taxonomy.test.ts
npx playwright test e2e/analytics-consent.spec.ts
```
