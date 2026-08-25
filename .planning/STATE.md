---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-08-24"
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 42
  completed_plans: 31
  percent: 74
---

# Project State

## Current Goal

Turn broad web beach utility and native surf calls into a measurable repeat-use loop without assuming every web visitor is a surfer or introducing duplicate ownership, alert, routing, session, analytics, or release systems.

The native retention hypothesis is explicit: Quiver earns a return by remembering and explaining a watched call—not by reducing session-log friction again.

## Current Status

Phase: 20.1
Plan: 20.1-01
Status: Planned — inflight/release audit, local tech-debt branch reconciliation, and mock review required before implementation
Full pre-cleanup history: [.planning/archive/2026-05-31-doc-cleanup/STATE-full-history.md](archive/2026-05-31-doc-cleanup/STATE-full-history.md)

Progress: 20 of 22 roadmap phases complete. Phase 20.1 execution progress: 0 of 6 planned plans complete, 0%.

Phase 21 remains sequenced after Phase 20.1 for roadmap execution, but it is not a clean untouched future phase: current summaries describe uncommitted implementation in worktrees for Plans 21-03 and 21-04, plus completed read-only verification in 21-05 with rollout blocked. Plan 20.1-01 must preserve and reconcile that work before adjacent files are edited.

The local branch `claude/tech-debt-audit-codex-973g1t` is now a mandatory Phase 20.1 workflow input. It was not visible as a pushed ref in the connected Quiver repositories when added, so its repository, worktree, head SHA, committed/uncommitted changes, issue output, and file ownership must be captured locally before affected native plans proceed.

## Active Requirements

- Execute BFR-01 through BFR-12 from `.planning/REQUIREMENTS.md`.
- Treat `20.1-INFLIGHT-AUDIT.md`, `20.1-TECH-DEBT-BRANCH.md`, and `20.1-MOCKS.md` as mandatory Phase 20.1 execution inputs.
- Locate and reconcile `claude/tech-debt-audit-codex-973g1t` before finalizing native ownership, deep-link, analytics, Home, Week Scout, favorites, refresh, or watched-call contracts.
- Treat native Home quick log, one-tap rating, session prefill, reminders, and full SessionForm as existing baseline/non-regression behavior, not a new Phase 20.1 product surface or primary metric.
- Preserve Phase 13 controlled refactor evidence in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Preserve Phase 20 app-link, attribution, baseline, and QA foundations rather than creating a second handoff system.
- Preserve or explicitly retire unique branch/worktree work before touching overlapping files; branch names and merge state are not release truth.
- Preserve the Phase 21 trusted-forecast worktrees until their uncommitted changes have a recorded land/preserve/retire disposition.
- Preserve approval gates for deploys, production mutations, production flags, outbound sends, native releases, payment actions, App Store actions, and entitlement changes.
- Update planning state only with durable decisions, current gaps, validation outcomes, and next actions.

## Open Gaps

### Phase 20.1 product gaps

- The web receives broad coastal utility traffic but has almost no durable beach ownership, intent qualification, or owned return destination.
- Many web visitors may not be surfers; a surf-qualified denominator and exact handoff-through-first-open funnel do not yet exist.
- Native Home can silently reset or rerank context, and the all-user Week Scout stability rollout requires current build/configuration and physical telemetry proof.
- Watch and alert adoption is too low to establish that either currently drives retention.
- Native one-tap sessions already exist and did not materially move retention or sales. Another outcome prompt, receipt, reminder, or friction pass is not an open Phase 20.1 hypothesis.
- Phase 20.1 has context, research, validation, an inflight audit, a dedicated tech-debt branch integration contract, six corrected low-fidelity mocks, and six executable plans, but no application implementation or production/device evidence yet.

### Inflight and release-truth gaps

- `claude/tech-debt-audit-codex-973g1t` is not currently visible as a remote ref in the connected Quiver repositories. Its expected native worktree and durable findings must be located and exported/pushed before removal or cross-machine reliance.
- `quiver#605` is an open `main -> prod` promotion. Phase 20.1 web release work must be rebased/rechecked after it resolves.
- `feat/redeem-success-page` contains unique old work that overlaps water-temperature/app-CTA surfaces and needs an explicit retire/rebuild/cherry-pick decision.
- Native `main` and `release/ota-build16-main-parity-20260822` are diverged. The exact production/TestFlight binary, runtime, channel, update ID, and source commit have not been established in this planning branch.
- `quiver-native#131` is binary-gated and far behind current `main`; it requires a rebuild/rebase or close decision before another binary train is planned.
- Post-merge native PR #156 still has a production migration, web counterpart work, and device verification gaps.
- Unique stale branches still touch native Home/BeachHero and Looking Ahead; their content must be retired or explicitly preserved before Phase 20.1 edits those contracts.
- Native `/app/spot/:slug` routing is simulator-verified through the app scheme. Full HTTPS universal-link and App Store first-open context recovery remain signed physical validation lanes.

### Phase 21 preservation gap

- Phase 21 Plans 21-03 and 21-04 are documented as implemented in worktrees but uncommitted; Plan 21-05 read-only verification is complete and reports rollout blocked before implementation integration. The worktrees, exact diffs, owners, and intended branch targets must be audited before Phase 20.1 or a future Phase 21 execution claims a clean baseline.

### Other open work

- Phase 13 is complete. Future refactor candidates are listed in [docs/refactor-roadmap.md](../docs/refactor-roadmap.md).
- Public launch deploy/alias status may have changed outside the repo and must be checked live before public claims.

## Decisions Already Made

- Web is a broad coastal utility and audience-qualification surface; native remains the dedicated surfing product.
- The durable object is a beach. A surf recommendation/window is temporary context attached to that beach.
- The universal web action is `Follow this beach`; the surf-qualified handoff is `Open this exact call in Quiver`; the native action is `Watch this call`.
- A water-temperature, tide, weather, or beach-page view alone never qualifies a visitor as a surfer.
- Web utility retention and surf-qualified web-to-native activation are measured separately from native product retention.
- Native keeps `Now`, `Best`, and `My spots`; Phase 20.1 does not add Planning, Decision, or Execution stages.
- The six Phase 20.1 mocks lock hierarchy, state, copy semantics, and continuity—not final pixels, production art, or App Store creative. Mock 06 is useful watched-call return, not a session/outcome flow.
- `claude/tech-debt-audit-codex-973g1t` is an audit/dependency input, not the automatic implementation base. Each logical slice must be classified as reference-only, land audit artifacts, bounded cherry-pick, separate rebased PR, superseded, or retire.
- No tech-debt branch or worktree is deleted before committed/uncommitted work and durable findings are captured.
- Broad technical-debt remediation remains independent unless a specific change is required to satisfy a BFR acceptance criterion.
- Week Scout stability must be enabled for all production users after approved release, with rollback, device, and PostHog evidence.
- Home changes must identify their real cause: mode, location, candidate set, filter, startup refinement, or forecast shift.
- Fast initial data acquisition may remain, but a provisional result cannot masquerade as a settled recommendation that silently swaps after delayed context arrives.
- `Watch this call` reuses existing alert infrastructure. Decision-relevant updates are `Still on`, `Call changed`, and `Better nearby`; no update is sent when nothing meaningful changed.
- Existing quick log/session behavior remains optional and independent. Phase 20.1 does not add a watched-call outcome, post-window prompt, learning receipt, reminder, or second session store.
- Session events remain secondary diagnostics and non-regression guardrails, not the primary retention outcome.
- No generic beach native app, new ML model, generic streak system, broad social feed, worldwide rollout, or localization is included in Phase 20.1.
- Launch objective remains iOS downloads from qualified demand, not generic web awareness.
- Product story for this phase is forecast -> check -> watch -> useful return.
- Founding access remains waitlist-safe until RevenueCat Web Billing and entitlement sync are proven.
- Brand-Vault is the source of truth for public launch visuals.
- Session Intelligence UI should use Brand-Vault visual assets before inventing new decorative art.
- Reddit remains comment-first unless explicitly reopened.
- Launch reporting uses existing event primitives extended with safe BFR follow/handoff/watch/update/reopen events.
- Sentry cron monitor ownership and critical alert routing were completed in Phase 12.
- Remaining production `@/lib/api-utils` imports outside wrapper internals were closed in Phase 13.
- Branch cleanup or worktree removal is never performed from branch names alone; uncommitted work is audited first.

## Next Actions

1. Locate `claude/tech-debt-audit-codex-973g1t` in the expected `quiver-native` repository or another Quiver worktree; capture its head, merge base, ahead/behind, committed/uncommitted changes, issues, and release/config impact.
2. Execute Task 0 in Phase 20.1 Plan 20.1-01:
   - refresh PRs, unique branches, worktrees, releases, migrations, OTA/binary truth, and direct issue collisions;
   - fill W/N/X disposition gates plus the tech-debt branch disposition;
   - preserve/reconcile the tech-debt branch and Phase 21 worktrees;
   - freeze implementation file ownership.
3. Complete the cross-repository reuse audit, including tech-debt findings, the existing quick-log baseline and non-impact, and all six corrected mock mappings against current components and the distributed release artifact.
4. Execute Plan 20.1-02 only after audit/pattern outputs name one ownership, handoff, watch, meaningful-update, exact-reopen, analytics, and experiment contract—with no new outcome/session contract.
5. Execute Plans 20.1-03, 20.1-04, and 20.1-05 in parallel only when file ownership is disjoint and their branch/release blockers are resolved.
6. Complete Plan 20.1-06 as a watched-call return and notification-quality evidence gate with mature before/after/holdout analysis, separating retention work from independent tech-debt remediation.
7. Resume Phase 21 roadmap execution only after its existing worktrees are reconciled and Phase 20.1 has an evidence-backed rollout disposition.
8. Preserve approval gates for deployment, schema mutation, production flags, outbound sends, native publication, App Store actions, payment, and entitlement changes.

## Accumulated Context

### Roadmap Evolution

- Phase 20.1 was added on 2026-08-24 for anonymous beach follow, My Coast, conservative intent qualification, exact surf handoff, Home continuity, all-user Week Scout stability, one-tap watched calls, bounded updates, and causal/guardrail evidence.
- The phase was revised the same day to include six web/native behavioral mocks and an explicit audit of PRs, branches, release divergence, uncommitted worktrees, merged-but-unreleased work, and issue collisions.
- The phase was corrected again after confirming one-tap native sessions were already shipped and did not move the needle. Outcome/session implementation was removed; watched-call return became the explicit retention hypothesis.
- `claude/tech-debt-audit-codex-973g1t` was then added as a mandatory local/worktree audit lane so its technical-debt findings and overlapping changes are reconciled before native Phase 20.1 implementation.
- Phase 21 adds Multi-Forecaster Forecast Adjustment and Production Ingestion and follows Phase 20.1 in roadmap sequencing while existing uncommitted work is preserved and audited.
- Phases 14-20 established Session Intelligence, utility-safe SEO surfaces, exact app links, attribution, baseline measurement, and release verification.

## Historical Notes

The previous state file held detailed accumulated decisions from Phases 1-12. That history is archived because it is useful for audit but too large for future Codex sessions to load by default. Current sessions should read this file, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, the complete Phase 20.1 folder including `20.1-TECH-DEBT-BRANCH.md`, corrected mocks, and inflight audit, `.planning/PROJECT.md`, and [docs/refactor-roadmap.md](../docs/refactor-roadmap.md) first.
