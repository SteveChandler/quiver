# Quiver Web — Backlog (not-ready / parked work)

Captured 2026-06-23 during a workspace cleanup pass. Shipped branches/worktrees were pruned;
not-ready work is recorded here. Local-only code was archived (full fidelity) to
`worktree-backups/cleanup-20260623/quiver/` at the workspace root before its local branch was deleted.

**Restore a bundled branch:** `git fetch ../worktree-backups/cleanup-20260623/quiver/branch-<slug>.bundle refs/heads/<branch>:<branch>`
**Apply an archived worktree diff:** `git apply worktree-backups/cleanup-20260623/quiver/wt-<name>.patch` (untracked files in the matching `*-untracked.tgz`).

## Active — still live (NOT deleted)
- **`chore/roadmap-seed-prod-snapshot`** — open PR [#333](https://github.com/SteveChandler/quiver/pull/333), resync `roadmap_v1_seed.sql` to prod snapshot. On origin. Decide: merge or close.

## Product backlog — growth / activation
- **Quiver Pro Preview + value-triggered trial ask** — Based on Strava/AllTrails trial research from 2026-06-24. Do not lead with an end-of-onboarding annual trial wall. Instead, continue onboarding after setup: watch the user's home spot, prove value through a forecast match/alert/session-log/custom-spot moment, then ask for the annual App Store trial. Keep annual pricing. Lower the visual prominence of the skip path, but keep it accessible. Candidate test: grant a limited Pro Preview or preview-like experience before the paid trial ask; if keeping App Store trial only, frame the lifecycle explicitly like AllTrails (today, reminder, billing date) and trigger it only after value proof. Success metrics: `paywall_trial_cta_tapped`, `purchase_started`, `purchase_success`, alert tap/open attribution, first-session submit, and trial-start rate by trigger source.

## Parked features — durable on origin (local branch deleted, restore via `git checkout -b <b> origin/<b>`)
- **`codex/home-filter-parity`** — 11 commits, unmerged. Home filter parity work. No PR. Next: review whether still wanted vs current home.
- **`docs/cdip-direction-shadow-guard-spec`** — 3 commits. Spec for CDIP direction shadow-guard. Pairs with the seaside CDIP-fallback calibration issue. Next: turn spec into a phase plan or drop.
- **`codex/prod-app-first-2026-06-17`** — 43 commits, superseded by the shipped app-first landing (PR [#330](https://github.com/SteveChandler/quiver/pull/330)). Likely dead; keep on origin only as history.

## Parked experiments — local-only, ARCHIVED as bundles, then deleted
Restore from `worktree-backups/cleanup-20260623/quiver/branch-*.bundle`.
- **`feat/owned-attribution-funnel`** (13 commits) — owned/organic attribution funnel. Most substantial parked item. Relates to shipped paid-attribution funnel (#320). Next: decide if owned-channel attribution is on the roadmap.
- **`chore/wip-snapshot-20260618`**, **`wip/board-pick-volume`**, **`wip/chore-misc`**, **`wip/discovery-and-oracle`**, **`wip/landing-native-cta`**, **`wip/learning-loop-progression`**, **`wip/planning-docs`**, **`wip/surf-map-prototype`** (4 commits each, branched from one 2026-06-18 snapshot) — assorted exploratory WIP. Triage individually if revisited; otherwise dead.
- **`feature/best-time-expansion-may15`**, **`feature/water-temp-lead-sentence-may15`** (1–2 commits, ~May 15) — old, almost certainly superseded.
- **`feature/ocean-viz`** (1 commit) — ocean visualization spike.
- **`codex/custom-spot-community-calibration`** (1 commit) — community calibration for custom spots. Relates to Surf Zone Intel direction.
- **`codex/week-scout-prefs-web-oracle`** (1 commit) — week-scout prefs on web Oracle; native shipped its version.

## Uncommitted experiments — ARCHIVED as patches (worktree removed)
Apply from `worktree-backups/cleanup-20260623/quiver/wt-*.patch`.
- **`config-minimalism`** worktree — 1.7MB uncommitted diff on `chore/config-minimalism` (already shipped via #20-era). Large; review before reapplying — may be mostly generated/lockfile churn.
- **`prod-forecast-alerts-seo-20260623`** worktree — 97 dirty files + 27 untracked on the prod-shipped alerts/SEO branch. Post-ship experiments.
- **`alert-email-main`**, **`email-alert-overhaul`** worktrees — ~20 dirty files each on shipped email-alert branches.
- **stash@{0}** ("grab-bag cleanup", AEO learn-doc edits) → `stash-0-grab-bag-cleanup.patch`.
