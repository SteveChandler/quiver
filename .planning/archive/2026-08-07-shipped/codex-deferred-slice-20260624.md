# Codex task — Build the deferred "alerts + forecast-display + session" prod slice

Build ONE targeted `main → prod` slice for the files deferred from the 2026-06-24 prod
promotion batch (#340–#345). These are bidirectionally diverged between `main` and `prod`,
so this is a careful 3-way merge, not a forward. Open a PR to `prod` for review — do NOT
auto-merge (touches the daily alert send path + surf display + session logging).

## Ground rules (learned in the batch)
- prod + dev share ONE Supabase instance (`vawdnbbgawichorsjiwe`); migrations are already
  applied. **Ship code-only** — do NOT touch `supabase/migrations/`.
- CI is disabled on this repo → the gate is LOCAL: `yarn typecheck`, targeted `yarn jest`,
  and a local **prod build** (`yarn build`, Node 22). e2e is not the gate (prod lacks the
  e2e auth-fixture closure) — exclude e2e specs from the slice.
- The native scoring closure (`lib/scoring/native-condition-score.ts`,
  `lib/services/discovery/window-selector/*`, `lib/profile/skill-level.ts`) is ALREADY on
  prod (merged via #340/#344/#345), so you should NOT need to bring it again.

## Recipe
1. `git fetch origin && git switch -c codex/prod-alerts-display-20260625 origin/prod`
   (work in a worktree under `.claude/worktrees/` if you prefer).
2. For each file below: 3-way merge with `git merge-file -p <prod> <merge-base> <main>`
   where merge-base = `git merge-base origin/prod origin/main`. Auto-merged hunks: keep.
   True conflicts: take the **newer-dated side** (`git log -1 --format=%cs origin/main -- F`
   vs prod) — but for the alert-cron LOGIC and `use-condition-intelligence` (31 prod-only
   lines), read both sides and merge by hand; don't blind-pick. Flag every hand-resolved
   hunk in the PR body for review.
3. Close the import graph: `yarn typecheck`, bring any missing modules from `origin/main`
   (check each for prod-only divergence first; 3-way merge if diverged, don't overwrite).
4. Bring `main`'s versions of the TESTS for any file where you took `main`'s code
   (otherwise prod's older tests fail against new code — this bit us repeatedly).
5. Route closure: grep the slice's `href`/`router.push` targets; confirm each route exists
   on prod.
6. Verify: `yarn typecheck` clean, targeted `yarn jest` green, local `yarn build` green.
7. Add a focused CHANGELOG `[Unreleased]` entry. Open the PR to `prod`.

## Files (grouped)
**Rule-based push-alert crons** (the heaviest — `condition-alert-deliver` had ~4 conflict hunks; logic, merge carefully):
- `app/api/cron/condition-alert-deliver/route.ts`
- `app/api/cron/condition-alert-evaluate/route.ts`
- `lib/alerts/revalidate-alert-window.ts`
- `lib/alerts/actionable-window-selector.ts`

**Forecast display path** (`use-condition-intelligence` has 31 prod-only lines — true 3-way):
- `components/beach-detail/tabs/forecast-tab.tsx`
- `hooks/use-condition-intelligence.ts`
- `components/forecast/horizon-strip.tsx`
- `components/forecast/forecast-feedback-capture.tsx`
- `lib/utils/horizon-strip-utils.ts`
- `context/profile-context.tsx` (adds `useOptionalProfileContext`)

**Session-logging path** (`session-actions` has ~4 prod-only lines):
- `actions/session-actions.ts`
- `app/sessions/new/useSessionSubmission.ts`
- `app/sessions/new/page.tsx`
- `lib/utils/session-wizard-params.ts`
- `types/session-wizard.ts`

## Known interface coupling (from the deferred-merge attempt)
- `forecast-tab.tsx` calls `useConditionIntelligence(forecasts, beach, beachTimezone, profileExperienceLevel)` — main added the 4th (skill) arg; the hook + `horizon-strip-utils` consume `native-condition-score` + `window-selector` (already on prod).
- `useSessionSubmission.ts` calls `createLoggedSession` (`actions/session-actions.ts`) — main changed its session-type signature; merge the two together or they won't typecheck.

## Output
A PR to `prod` titled e.g. `feat(alerts+display): promote deferred alert/forecast-display/session slice to prod`, with a body listing every hand-resolved conflict and a "review the alert send path + surf display copy" note. Recommend running forecast-qa after.
