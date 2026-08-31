# Chromatic Visual Regression Baselines

## Scope
Visual snapshot coverage for the two highest-traffic screens: the landing
`HeroSection` (`src/stories/visual-regression.stories.tsx`, story
`LandingHero`) and the `JoinRoomForm` flow (`src/components/settings/JoinRoomForm.stories.tsx`,
covering idle/loading/error/success states). Both story files are tagged
`visual-regression` and set `parameters.chromatic.disableSnapshot = false`
so they're captured by Chromatic.

## CI wiring
`.github/workflows/frontend-ci.yml` runs a `chromatic` job (via `npm run
chromatic`, defined in `frontend/package.json`) after `frontend-checks`
passes. It requires a `CHROMATIC_PROJECT_TOKEN` repository secret; if unset
(e.g. on a fork), the step is skipped rather than failing the build. The
script uses `--exit-zero-on-changes`, so a visual diff surfaces in the
Chromatic UI/PR check without blocking merges by itself — treat it as a
review signal, not a hard gate, unless that's later tightened.

## Updating a baseline
1. Make your intentional visual change.
2. From `frontend/`, run `CHROMATIC_PROJECT_TOKEN=<token> npm run chromatic`
   locally, or open the Chromatic build linked from the PR check.
3. Review the diff in the Chromatic UI and accept it if the change is
   expected. Accepted snapshots become the new baseline for subsequent runs.
4. If you don't have the project token locally, push the branch and let the
   CI `chromatic` job produce the build for you to review/accept instead.

## Adding more stories to the baseline
Add `tags: ['visual-regression']` and
`parameters: { chromatic: { disableSnapshot: false } }` to a story's default
export (see `JoinRoomForm.stories.tsx`), or add a new story under
`Visual Regression/Baseline` in `src/stories/visual-regression.stories.tsx`
for components that don't warrant their own dedicated stories file.
