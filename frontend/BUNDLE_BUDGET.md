# Bundle Budget

## Overview

CI enforces gzip size limits on the Next.js build output. A PR that exceeds any budget will **fail the `frontend-checks` CI job** (step: *Check bundle size*) and cannot be merged until resolved.

Budgets are defined in [`.size-limit.json`](./.size-limit.json).  
The check is run by [`scripts/check-bundle-size.mjs`](./scripts/check-bundle-size.mjs) via `npm run bundle:check`.  
Each run writes `bundle-size-report.json` (uploaded as a `bundle-size-report` artifact, retained 30 days) for trend tracking.

---

## CI integration (#1460)

The bundle check runs as a step inside the `frontend-checks` job, **after** `npm run build`:

```yaml
- name: Check bundle size
  run: npm run bundle:check          # exits 1 on any breach → fails the job

- name: Upload bundle size report
  if: ${{ !cancelled() }}
  uses: actions/upload-artifact@v4
  with:
    name: bundle-size-report
    path: frontend/bundle-size-report.json
    retention-days: 30
```

The report artifact is available under the *Artifacts* section of every workflow run, even when the build fails. Download it and compare `sizeBytes` across runs to track trends.

---

## Current Budgets

| Name | Limit | Notes |
|---|---|---|
| First Load JS (shared) | 120 kB | React + Next.js framework chunk |
| Main page JS | 50 kB | Next.js runtime bootstrap |
| Total First Load JS | 350 kB | All JS on first navigation |
| Total build output (JS) | 1500 kB | All JS chunks across all routes (gzip) |
| Shop Grid route JS | 40 kB | Shop page + ShopGrid + ShopItem components |

### Join Room route status (SW-FE-846)

The join-room page was audited in [SW-FE-846](./docs/SW-FE-846-join-room-bundle-size-audit.md).  
After import optimisations the page JS sits at **~46 kB** (gzip), which is within the overall Total First Load JS budget.  
No per-route budget entry for join-room is needed at this time. If the route grows above 60 kB (gzip) a dedicated entry should be added to `.size-limit.json`.

---

## How to Fix a Budget Breach

### 1. Identify the offending chunk

```bash
# Build locally and inspect chunk sizes
cd frontend
npm run build
# Check the report
cat bundle-size-report.json
```

Next.js prints a size table after build — look for chunks marked in yellow/red.

### 2. Common causes and fixes

| Cause | Fix |
|---|---|
| Large dependency added | Use dynamic `import()` to lazy-load it |
| Icon library imported wholesale | Import only the icons used: `import { X } from 'lucide-react'` |
| Image imported as JS | Move to `public/` and reference via `<Image src="...">` |
| Duplicate package versions | Run `npm dedupe` and check `npm ls <package>` |
| Unoptimised SVG | Run through [SVGO](https://github.com/svg/svgo) or use `next/image` |
| Large font file | Use `next/font` with `display: swap` and subset |

### 3. Verify locally

```bash
node scripts/check-bundle-size.mjs
```

---

## Exemption Process

If a budget increase is genuinely necessary (e.g. a new major feature requires a large dependency):

1. **Open a PR** with the code change.
2. **Update `.size-limit.json`** with the new limit and a `notes` explanation.
3. **Update `bundle-baseline.json`** by running `node scripts/check-bundle-size.mjs` after a successful build and committing the output.
4. **Tag the PR** with the `bundle-exemption` label.
5. **Get approval** from a tech lead and the design team (see below) before merging.

Exemptions must include a justification comment in `.size-limit.json` on the relevant entry.

---

## Coordinating with Design on Asset Bloat

Large assets (images, fonts, animations) are the most common source of unexpected bundle growth.

**Before adding new assets:**
- Confirm with design that the asset is production-ready and optimised.
- Images must be exported at 2× max and run through [Squoosh](https://squoosh.app/) or similar.
- Animations (Lottie, etc.) must be reviewed for file size before handoff.
- New fonts require sign-off; use `next/font` with subsetting.

**Design checklist for asset PRs:**
- [ ] Image dimensions confirmed (no 4K images for 200px slots)
- [ ] Format is WebP or AVIF where supported
- [ ] SVGs are optimised via SVGO
- [ ] No raw `.gif` files (use video or Lottie)
- [ ] Font subsets defined

---

## Trend Tracking

`bundle-size-report.json` is uploaded as a CI artifact on every run. To view the trend:

1. Go to the GitHub Actions run for any PR or push.
2. Download the `bundle-size-report` artifact.
3. Compare `sizeBytes` values across runs.

On merges to `main`, CI commits the updated `bundle-baseline.json` back to the branch so the baseline always reflects the current production bundle.
