# Frontend Bundle Budget (SW-FE-004)

This document defines the performance budget for the Tycoon frontend, with a
specific focus on the NEAR wallet experience. It is the source of truth for the
CLS/LCP budget tracked under **SW-FE-004** and referenced by
`frontend/docs/SW-FE-004-near-wallet-cls-lcp-budget.md`.

## Scope

The budget applies to the NEAR wallet surface only. Per ADR-003, NEAR is the
only supported chain UI until Stellar is gated ready; Stellar wallet routes are
not part of this budget and must not be counted against it.

## Core Web Vitals budget

| Metric | Target (p75) | Hard fail |
| ------ | ------------ | --------- |
| LCP (Largest Contentful Paint) | <= 2.5s | > 4.0s |
| CLS (Cumulative Layout Shift) | <= 0.10 | > 0.25 |
| INP (Interaction to Next Paint) | <= 200ms | > 500ms |
| TTFB (Time to First Byte) | <= 800ms | > 1.8s |

Measurements are taken on the NEAR wallet route at the 75th percentile over a
rolling 7-day window of real-user monitoring (RUM) data, plus a synthetic
Lighthouse run in CI on every PR that touches the wallet surface.

## JavaScript budget

| Chunk | Budget (gzip) |
| ----- | ------------- |
| NEAR wallet route (first load JS) | <= 180 KB |
| Shared framework baseline | <= 120 KB |
| Per-route lazy chunks | <= 60 KB each |

Any PR that pushes the NEAR wallet first-load JS over budget must either reduce
it or include an explicit, reviewed justification in the PR description.

## CLS rules for the NEAR wallet

Layout shift on the wallet surface is dominated by async auth and balance data.
The following rules are mandatory:

1. Reserve fixed dimensions for the wallet card, balance rows, and the
   connect/disconnect button before data resolves. Never render a zero-height
   placeholder that grows once the NEAR account loads.
2. Render skeleton states with the same box dimensions as the resolved content
   so the swap does not shift layout.
3. Do not inject banners, toasts, or error strips above the wallet card without
   reserving their space up front.
4. Fonts used by the wallet surface must be preloaded with `font-display: swap`
   and a matched fallback metric to avoid late font-swap shift.

## LCP rules for the NEAR wallet

1. The wallet card heading is the designated LCP element; it must render from
   server output and must not depend on client-side auth resolution.
2. Auth-gated content (balances, account id) loads after LCP and must not block
   the LCP element from painting.
3. Avoid client-only rendering of the wallet shell; the shell must be part of
   the initial HTML payload.

## Enforcement

- CI runs a Lighthouse budget check on the NEAR wallet route; a hard-fail
  breach blocks merge.
- RUM alerts fire when the p75 LCP or CLS exceeds the target for two
  consecutive days.
- Budget regressions are triaged under SW-FE-004 and must be resolved or
  explicitly waived by a maintainer.

## Out of scope

- Stellar wallet routes (not yet gated ready per ADR-003).
- Backend, shop-api, and contract performance budgets.
- Mainnet deploy readiness, which is tracked separately.
