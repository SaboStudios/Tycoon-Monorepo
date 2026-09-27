# SW-FE-001 - Landing Hero Rollout
This change is part of the Stellar Wave frontend batch and targets home page hero performance and accessibility.

## Scope
- Eager render the above-the-fold hero on `/`.
- Defer below-the-fold sections with lightweight placeholders.
- Stabilize animated hero copy to reduce layout movement.
- **Accessibility (SW-FE-001):** Fix heading hierarchy, landmark labels, button names, and decorative element hiding in `HeroSection`.

## Accessibility Changes
| Issue | Fix |
|---|---|
| Two `<h1>` elements (decorative bg + real title) | Decorative bg `<h1>` changed to `<p>` with `aria-hidden="true"` |
| `<section>` had no accessible name | Added `aria-label="Hero"` |
| Buttons had no accessible names | Added `aria-label` to all 4 CTA buttons |
| Decorative background `<div>` exposed to AT | Added `aria-hidden="true"` |
| Decorative SVG shapes inside buttons exposed to AT | Added `aria-hidden="true"` on each `<svg>` |
| Decorative inner `<span>` labels inside buttons | Added `aria-hidden="true"` (button `aria-label` carries the name) |
| Decorative `?` span in title | Added `aria-hidden="true"` |

Focus order is now: section landmark → welcome text → animated tagline → `<h1>` title → description → CTA buttons (top to bottom). No focusable decorative elements remain in the tab sequence.

## Feature Flag Plan
No runtime flag is added in this patch to keep bundle/runtime complexity low.
Use a staged rollout instead:
1. Deploy to preview and compare Core Web Vitals (LCP/CLS) vs baseline.
2. Deploy to a low-traffic environment first (internal/canary).
3. Promote to full production once no regressions are observed.

If rollback is needed, revert this single patch set touching `HeroSection` and its test file.

## Migration Notes
- No API changes.
- No schema/data migration.
- No user action required.
- `HeroSectionMobile` already had correct `aria-label` attributes; no changes needed there.

## Verification Checklist
- `npm run typecheck`
- `npm run test`
- Confirm home route renders primary CTA and title immediately on first paint.
- Verify with a screen reader (or axe DevTools) that only one `h1` is announced and all buttons have meaningful names.
- Monitor LCP and CLS in production telemetry after deploy.

## SW-FE-007 - Security Hardening

### No MSW in production bundle
- MSW is a dev/test-only dependency. It must never be imported from application code paths that ship to production.
- The browser worker is started only when `process.env.NODE_ENV !== 'production'` **and** an explicit opt-in flag (`NEXT_PUBLIC_ENABLE_MSW === 'true'`) is set. Both conditions are required so a misconfigured production env cannot enable request mocking.
- `msw` is listed under `devDependencies` only; `bundle:check` fails the build if `msw` (or `@mswjs/*`) appears in the client bundle.
- The service worker file (`public/mockServiceWorker.js`) is excluded from production deploys and is not referenced by any shipped module.

### CSP compatibility
- No inline event handlers (`onclick=`, etc.) and no `eval`/`new Function` in hero code.
- No remote script/style origins are introduced by the hero; all assets are same-origin or covered by the existing `script-src`/`style-src` allow-list.
- No `dangerouslySetInnerHTML` in `HeroSection`; all copy is rendered as text nodes.

### No open redirects
- Hero CTAs navigate to fixed, in-app routes only. No CTA reads a redirect target from query params, `location`, or user input.
- Any future external link must be validated against an allow-list of known hosts before navigation.

### Telemetry & PII
- Analytics events fire only after consent is granted; before consent, no hero event is emitted.
- Event payloads carry no PII: no wallet address, email, token, or free-text input. Only coarse, enumerated values (e.g. `cta_id`, `variant`) are sent.
- Unknown/undeclared analytics providers fail the build rather than silently dropping or forwarding events.

### Deny-by-default
- The hero exposes no admin, WS, or mutation surface. All money/dice/inventory/admin state remains server-authoritative.
- Any new hero action surface must be deny-by-default and explicitly authorized server-side.

## SW-FE-008 - MSW & Vitest Coverage

### MSW handlers
- Handlers live under the test tree only and are wired through `setupServer` for Vitest (node) and `setupWorker` for local dev (browser).
- Handlers cover the hero's live API calls with success, empty, and error (500) responses so loading/empty/error states are exercised without hitting real services.
- No handler is imported by production code; the MSW entrypoint is tree-shaken out of the prod bundle.

### Vitest + RTL
- `HeroSection` is rendered with React Testing Library under Vitest.
- Required cases:
  - **Loading:** skeleton/placeholder is shown while the hero data request is pending.
  - **Empty:** a valid empty response renders the empty state, not an error.
  - **Error:** a 500 response renders the error state with a retry affordance; a wallet reject is surfaced as a non-fatal message.
  - **a11y:** exactly one `h1`; section has an accessible name; every CTA has an accessible name; decorative nodes are hidden from the accessibility tree.
  - **Keyboard:** tab order matches the documented focus order; no decorative element is focusable.
  - **Double CTA click:** a second click while the first is in flight does not issue a duplicate request (idempotent guard).
- Tests assert on roles/labels (not implementation details) so they stay valid across refactors.

### Playwright smoke / critical path
- Smoke: `/` renders the hero title and primary CTA on first paint.
- Critical: primary CTA navigates to the expected in-app route; no open redirect.
- Critical: with the API forced to 500, the hero shows the error state and the retry path recovers.

## Edge Cases & Failure Modes
- **Concurrent duplicate requests / reconnect retries:** hero data fetch and CTA actions are idempotent; a second in-flight request is coalesced or ignored.
- **Dependency outage (Postgres/Redis/shop-api/RPC):** reads degrade to the error state; writes fail closed. The hero never fabricates success.
- **Auth expiry mid-flow / forbidden role:** the hero surfaces a re-auth prompt or a forbidden message; it does not silently retry into a loop.
- **Invalid or adversarial input:** oversized payloads and spoofed events are rejected; no enumeration of internal IDs is exposed in hero copy or telemetry.
- **API 500 vs empty:** a 500 renders the error state; a 200 with an empty body renders the empty state. These are distinct and tested.
- **Wallet reject:** treated as a user-cancelled action, not an error incident; no telemetry PII is emitted.
- **Slow 3G layout shift:** hero reserves space for animated copy and media so CLS stays within budget; below-the-fold sections are deferred with fixed-size placeholders.
- **Double CTA clicks:** guarded so only one navigation/request is issued per intent.

## Budgets
- **Bundle:** heavy wallet/board dependencies are code-split and not imported by the hero. `bundle:check` must pass; `msw` must not appear in the client bundle.
- **CLS:** hero reserves layout space for animated copy and deferred sections to keep CLS within the documented budget.

## Acceptance Criteria
- [ ] SW-FE-001/007/008 acceptance criteria satisfied.
- [ ] Bundle and CLS budgets hold (`bundle:check` green).
- [ ] a11y tests green (single `h1`, named landmark, named CTAs, hidden decoratives).
- [ ] Vitest RTL covers loading/empty/error, a11y, keyboard, and double-click cases.
- [ ] Playwright smoke/critical paths cover the hero funnel.
- [ ] No MSW in the production bundle; CSP-compatible; no open redirects; telemetry gated on consent and PII-free.
- [ ] CI gates updated if needed.

## Out of Scope
- Unrelated package refactors.
- Mainnet irreversible deploys without a readiness issue.
