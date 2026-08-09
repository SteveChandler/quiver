# Codex task — Converge PR #346, then hotfix-promote the forecast scoring fix to prod

Two parts. Do them in order. Work in `quiver/`. Open a PR to `prod` but do NOT auto-merge.

## Background
PR **#346** (`fix(forecast): align scoring invariants`, single commit `7253e6168`, base `main`,
branch `codex/forecast-pr344-qa-fixes`) fixes two PRE-EXISTING scoring bugs:
1. `lib/domains/scoring/discovery-adapter.ts` — `forecastToSnapshot` could use dominant swell for
   `primarySwell` while keeping a stale top-level `wavePeriod`/`waveDirection` (violates the
   post-b06f5708 invariant `snapshot.primarySwell.periodS === snapshot.wavePeriod` and
   `...directionDeg === snapshot.waveDirection`).
2. `lib/surf/scoring.ts` line ~145 — JS modulo wrap bug: `offFromCenter` used
   `Math.abs(((normalizeDeg(waveDirectionDeg) - (center + 540)) % 360) - 180)`, which returns >180
   for every direction, zeroing the swell-direction term on non-wrapping windows.

These bugs are **live on prod** (the modulo fix only ever existed on the unmerged
`feat/last-mile-legibility` branch, commit `95895602f`). #346 fixes `main`; prod still needs it.

## Part A — Converge #346 with the canonical fix (avoid a future double-fix conflict)
On branch `codex/forecast-pr344-qa-fixes`, #346 currently fixes the modulo bug by *ungrouping* the
inline math (`- center + 540`). The canonical fix on `feat/last-mile-legibility` (`95895602f`)
instead reuses the **local** `angularDistance(aDeg, bDeg)` helper already defined in
`lib/surf/scoring.ts` (around line 98). They are behaviorally identical but textually conflicting.

1. In `lib/surf/scoring.ts`, replace the `offFromCenter` assignment with:
   `const offFromCenter = angularDistance(waveDirectionDeg, center);`
   (the local helper — no new import needed; confirm it's the in-file `angularDistance`, not the one
   in `lib/alerts/degree-utils.ts`). Keep the explanatory comment from `95895602f` if you like.
2. Re-run `yarn jest __tests__/lib/surf/terrain-scoring.test.ts __tests__/lib/domains/scoring/discovery-adapter.test.ts` and `yarn typecheck` — both must stay green (the change is value-identical).
3. Amend or add a commit on `codex/forecast-pr344-qa-fixes` and push. #346 now converges with
   `95895602f`, so when `feat/last-mile-legibility` eventually merges to main that line is conflict-free.

## Part B — Hotfix-promote the (converged) fix to prod
prod + dev share ONE Supabase instance (`vawdnbbgawichorsjiwe`); no schema involved → **code-only**,
do NOT touch `supabase/migrations/`. CI is disabled → gate locally.

1. `git fetch origin && git switch -c codex/prod-scoring-hotfix-20260625 origin/prod`.
2. `git cherry-pick <converged #346 head sha>` (the 4-file commit: `discovery-adapter.ts`,
   `lib/surf/scoring.ts`, `__tests__/lib/domains/scoring/discovery-adapter.test.ts`,
   `__tests__/lib/surf/terrain-scoring.test.ts`). The buggy `offFromCenter` line is byte-identical on
   prod and main, so the scoring.ts hunk applies clean. If `discovery-adapter.ts` conflicts (prod may
   have diverged — #344 did NOT touch it), resolve by applying the same invariant fix to prod's
   version: `forecastToSnapshot` must derive `primarySwell` via `pickDominantSwell` AND set
   `wavePeriod`/`waveDirection` from that same dominant swell (keep them consistent). Don't overwrite
   prod's file wholesale with main's.
3. Close the import graph: `yarn typecheck` clean. Bring any missing helper only if prod lacks it
   (3-way merge, don't overwrite a diverged file).
4. Verify: `yarn typecheck`; `yarn jest __tests__/lib/surf/terrain-scoring.test.ts __tests__/lib/domains/scoring/discovery-adapter.test.ts` (+ any scoring/forecast suite that exercises these); scoped `eslint` on the 2 changed source files; local `yarn build` (Node 22). Exclude e2e.
5. Add a focused CHANGELOG `[Unreleased]` entry. Open a PR to **`prod`** titled
   `fix(forecast): hotfix dominant-swell invariant + swell-dir modulo on prod`. **Do not auto-merge.**

## Output
PR #346 updated (converged), and a new prod hotfix PR. Report the cherry-pick result (clean vs
hand-resolved), test/build status, and confirm the two invariants now hold on prod's code.

## Note (out of scope, track separately)
The Surfline under-call on displayed face heights is a calibration/display-height issue, NOT fixed
here. Leave it for a dedicated calibration pass.
