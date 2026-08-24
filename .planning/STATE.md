---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-08-24"
progress:
  total_phases: 9
  completed_phases: 7
  total_plans: 43
  completed_plans: 31
  percent: 72
---

# Project State

## Current Goal

Turn broad web beach utility and native surf calls into a measurable repeat-use loop without assuming every web visitor is a surfer or introducing duplicate ownership, alert, routing, session, analytics, or release systems.

The native retention hypothesis is explicit: Quiver earns a return by remembering and explaining a watched call—not by reducing session-log friction again.

## Current Status

Phase: 20.1  
Plan: 20.1-01  
Status: Planned — inflight/release audit, local tech-debt branch reconciliation, cleanup dispositions, and mock review required before implementation

Progress: 20 of 22 roadmap phases complete. Phase 20.1 has **0 of 7** planned execution lanes complete:

```text
20.1-01 audit/reuse/ownership
20.1-TD native cleanup train
20.1-02 shared contracts
20.1-03 web follow/My Coast
20.1-04 exact handoff
20.1-05 native continuity/watch/return
20.1-06 evidence/rollout decision
```

Phase 21 remains sequenced after Phase 20.1, but it is not a clean untouched future phase: its summaries describe uncommitted implementation in worktrees for 21-03/21-04 and completed read-only verification in 21-05 with rollout blocked. Preserve and reconcile those worktrees before adjacent edits.

## Active Requirements

- Execute BFR-01 through BFR-12 from `.planning/REQUIREMENTS.md`.
- Treat the complete Phase 20.1 folder as mandatory input, especially:
  - `20.1-INFLIGHT-AUDIT.md`;
  - `20.1-TECH-DEBT-BRANCH.md`;
  - `20.1-TECH-DEBT-CLEANUP-SLICES.md`;
  - `20.1-TD-PLAN.md`;
  - `20.1-MOCKS.md`.
- Locate and freeze `claude/tech-debt-audit-codex-973g1t` before finalizing native ownership, deep-link, analytics, Home, Week Scout, favorites, refresh, or watched-call contracts.
- Verify TD-01 through TD-05 against current `quiver-native/main`; every slice must be `land`, `superseded/no-op`, or `blocked` before overlapping implementation.
- Execute landed cleanup slices as isolated commits/PRs with reference scans, focused tests, typecheck, and `git revert` rollback.
- Treat Home quick log, one-tap rating, session prefill, reminders, and full SessionForm as baseline/non-regression behavior, not a Phase 20.1 product surface or primary metric.
- Preserve Phase 20 exact app-link, attribution, baseline, and QA foundations.
- Preserve or explicitly retire unique branch/worktree work before touching overlapping files; merge state is not release truth.
- Preserve Phase 21 trusted-forecast worktrees until their uncommitted changes have a recorded disposition.
- Preserve approval gates for deploys, production mutations, flags, outbound sends, native releases, App Store actions, payment, and entitlement changes.

## Open Gaps

### Product

- Web has broad coastal utility traffic but little durable beach ownership, intent qualification, or owned return destination.
- The surf-qualified web-to-native funnel is not measurable end to end.
- Native Home can silently reset/rerank context; all-user Week Scout stability still needs build and physical telemetry proof.
- Watch/alert adoption is too low to establish retention impact.
- One-tap sessions already exist and did not materially move retention or sales; another session-friction pass is not an open hypothesis.

### Cleanup train

The exact local paths/references have not yet been verified for:

- TD-01 `nearest-beach.ts`;
- TD-02 stale startup prefetch;
- TD-03 retired payoff card;
- TD-04 retired forecast prototype;
- TD-05 dormant Plan My Next Session policy stack.

The connected GitHub view did not expose these exact candidates on pushed `main`, so no deletion may occur until the local branch/worktree and current-main reference graph are captured.

### Inflight and release truth

- `claude/tech-debt-audit-codex-973g1t` was not visible as a remote ref; locate its expected native worktree and preserve committed/uncommitted findings.
- `quiver#605` remains the current `main -> prod` promotion and must resolve before Phase 20.1 web release work.
- `feat/redeem-success-page` overlaps utility/app-CTA surfaces and needs retire/rebuild/cherry-pick disposition.
- Native `main` and `release/ota-build16-main-parity-20260822` diverge; exact production/TestFlight build, runtime, channel, update ID, source commit, and flag value remain to be established.
- `quiver-native#131` is binary-gated and far behind current `main`; rebase/rebuild or close before another binary train.
- Post-merge native PR #156 still has production migration, web counterpart, and device gaps.
- Unique stale branches still touch Home/BeachHero and Looking Ahead.
- Signed HTTPS universal-link/App Store first-open recovery remains a physical-device validation lane.

## Decisions Already Made

- Web is broad coastal utility/audience qualification; native remains surf-specific.
- The durable object is a beach; a surf recommendation/window is temporary context.
- Web action: `Follow this beach`.
- Qualified handoff: `Open this exact call in Quiver`.
- Native action: `Watch this call`.
- A single utility page view never qualifies surfing.
- Native keeps `Now`, `Best`, and `My spots`; no Planning/Decision/Execution state machine.
- Mocks lock hierarchy/state/copy/continuity, not final pixels or App Store creative.
- Week Scout stability must ship enabled for all users after approved release with rollback and physical telemetry.
- Home changes identify their real cause; provisional data cannot masquerade as a settled hero.
- Supported watched-call updates are `Still on`, `Call changed`, and `Better nearby`; no push is manufactured when nothing meaningful changed.
- Existing quick log/session behavior remains optional and independent; no new outcome prompt, learning receipt, reminder, or session store.
- The local tech-debt branch is an audit/dependency source, not an automatic merge base.
- TD-01 through TD-05 form a separate cleanup train. One slice equals one isolated commit/PR and rollback.
- TD-02, TD-04, and TD-05 are serialized until exact ownership proves otherwise; TD-03 may run in parallel only with disjoint boat files and a safe E2E lane.
- Cleanup effects and retention treatment effects remain separately attributable.
- No generic beach-native mode, new ML model, streak system, broad social feed, worldwide rollout, or localization in this phase.

## Next Actions

1. Merge or close `quiver#605`, then refresh web `main...prod`.
2. Merge the planning-only PR #606 after review.
3. Execute 20.1-01:
   - locate/freeze `claude/tech-debt-audit-codex-973g1t`;
   - refresh all PR/branch/worktree/release/migration/OTA truth;
   - fill W/N/X gates, including X-04 cleanup disposition;
   - verify exact TD-01..TD-05 paths, references, live replacements, tests, and file ownership;
   - publish `20.1-REUSE-AUDIT.md`, `20.1-PATTERNS.md`, and `20.1-01-SUMMARY.md`.
4. Execute `20.1-TD` from clean current-main branches:
   - TD-01 nearest-beach;
   - TD-02 startup prefetch;
   - TD-03 payoff card when safe boat E2E is available or formally deferred;
   - TD-04 forecast prototype;
   - TD-05 dormant PMNS policy stack;
   - combined verification and cleanup summary.
5. Rebase Phase 20.1 implementation branches on the post-cleanup native base.
6. Review mocks against post-cleanup native and current web surfaces.
7. Execute 20.1-02 contracts, then parallel 20.1-03/04/05 only with disjoint ownership.
8. Complete 20.1-06 as watched-return/notification-quality evidence, keeping session and cleanup metrics secondary/separate.
9. Resume Phase 21 only after its worktrees are reconciled and Phase 20.1 has an evidence-backed disposition.

## Accumulated Context

- Phase 20.1 was added on 2026-08-24 for anonymous beach follow, My Coast, conservative intent qualification, exact handoff, Home continuity, all-user stability, watched calls, bounded updates, and causal evidence.
- It was expanded with six behavioral mocks and an inflight/release audit.
- It was corrected after confirming one-tap sessions already existed and did not move the needle; watched-call return became the hypothesis.
- `claude/tech-debt-audit-codex-973g1t` became a mandatory local/worktree audit lane.
- TD-01 through TD-05 were added as a separate pre-implementation cleanup train with exact reference/test/rollback gates.
- Phase 21 remains sequenced after Phase 20.1 while its existing uncommitted work is preserved.

## Historical Notes

Detailed earlier milestone history remains archived. Current sessions should read this file, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, the complete Phase 20.1 folder, `.planning/PROJECT.md`, and [docs/refactor-roadmap.md](../docs/refactor-roadmap.md) first.
