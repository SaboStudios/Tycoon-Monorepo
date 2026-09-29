# Frontend bundle budget

The bundle gate (#1759, #1460) blocks merges that make the player-facing
JavaScript heavier than agreed. It has three parts:

| Piece | File |
|---|---|
| Budgets (hard limits) | [`.size-limit.json`](.size-limit.json) |
| Last accepted sizes (regression baseline) | [`bundle-baseline.json`](bundle-baseline.json) |
| Gate | [`scripts/check-bundle-size.mjs`](scripts/check-bundle-size.mjs), tested by `scripts/check-bundle-size.test.mjs` |

The gate is dependency-free (Node ≥ 20). It reads the Next.js build output, so
it must run after `next build`.

## Budgets

All sizes are **gzip bytes (zlib level 9)**, and 1 kB = 1024 B.

| Budget | Kind | What is measured | Limit |
|---|---|---|---|
| First Load JS (shared) | `shared` | `rootMainFiles` in `.next/build-manifest.json`: the framework runtime every route loads | 120 kB |
| Main page JS | `route` `/` | Client chunks `/` loads on first paint, excluding shared | 50 kB |
| Join room page JS | `route` `/join-room` | Same, for the join-room funnel (SW-FE-846) | 50 kB |
| Total First Load JS (largest route) | `largestFirstLoad` | shared + the heaviest route's chunks; framework-internal `/_*` routes are skipped | 350 kB |
| Total build output (JS) | `glob` `.next/static/**/*.js` | Every emitted client JS file, including lazy chunks | 1500 kB |

Per-route chunks come from `.next/server/app/**/page_client-reference-manifest.js`
(`entryJSFiles` plus non-async `clientModules`). That works for Next 16
Turbopack builds, which no longer write `app-build-manifest.json`, and for
webpack builds. The manifests are parsed as JSON and never executed.

> **Headroom:** a bare Next 16.1 + React 19.2 app measures **117.1 kB**
> (119,916 B) for shared first-load JS before any Tycoon code. Most of the
> 120 kB shared budget is therefore framework. A framework upgrade that
> crosses it should be re-baselined deliberately (see below), not waved
> through.

## What fails the gate

| Exit code | Meaning |
|---|---|
| `0` | All budgets hold. |
| `1` | A budget is over its **hard limit**. |
| `1` | A budget **grew more than max(5 %, 1 kB)** over `bundle-baseline.json`, even if it is still under the limit. Tune this per budget with `maxRegressionPercent` / `minRegressionBytes`. |
| `1` | **Mock code in the client bundle.** MSW markers (`[MSW]`, `mockServiceWorker.js`, `INTEGRITY_CHECK_REQUEST`) were found in `.next/static`. See SW-FE-001 and SW-FE-1462. |
| `2` | **Fails closed on misconfiguration.** The build output is missing, the config is invalid, a budget names a route that is not in the build, a manifest lists a missing chunk, or a glob matches nothing. |

A budget whose baseline is `0` (never recorded) is checked against the hard
limit only. The output says `no baseline` for it.

Every run writes `bundle-size-report.json`, which CI uploads as the
`bundle-size-report` artifact. In GitHub Actions the gate also adds a table to
the job summary.

## Commands

```bash
cd frontend
npx next build                                     # or: npm run build
node scripts/check-bundle-size.mjs                 # check (same as CI)
node scripts/check-bundle-size.mjs --update-baseline   # record new sizes
node --test scripts/check-bundle-size.test.mjs     # unit tests for the gate
```

Options: `--dir <frontend dir>`, `--config <file>`, `--baseline <file>`,
`--report <file>`.

## When the gate fails

1. Read the `FAIL` line. It names the budget, its size, and whether it went
   over the limit or regressed against the baseline.
2. For a route budget, look for a new static import of a heavy dependency.
   Wallet and board dependencies must stay code-split behind
   `next/dynamic` / `import()` (SW-FE-004).
3. For mock code, find the static import that pulled `msw` into the graph.
   The SW-FE-1462 doc lists the rules: `msw/browser` may only be reached
   through the guarded dynamic import in `msw-provider.tsx`.

## Re-baselining (exemption process)

If a size increase is intentional (a new feature, or a framework upgrade):

1. Run `node scripts/check-bundle-size.mjs --update-baseline` on a production
   build of the PR branch. The gate refuses to write a baseline that is over a
   hard limit or contains mock code.
2. Commit `bundle-baseline.json` in the same PR, and say in the PR description
   why the size grew.
3. A reviewer signs off on the baseline diff. Raising a **hard limit** in
   `.size-limit.json` needs the same sign-off plus a note in this file.

Never lower a limit below the current baseline. That just moves the failure to
the next unrelated PR.

## CI

`.github/workflows/frontend-ci.yml`:

- `frontend-checks` runs `node scripts/check-bundle-size.mjs` right after
  `npm run build` and uploads the report.
- `frontend-gates` runs `node --test scripts/*.test.mjs`. It needs no
  `npm ci`, so the gate's own logic is verified even when dependency
  installation is broken.
