---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
last_updated: "2026-09-02"
progress:
  total_phases: 22
  completed_phases: 20
  total_plans: 42
  completed_plans: 36
  percent: 91
---

# Project State

## Current Goal

Turn broad web beach utility and native surf calls into a measurable repeat-use loop without assuming every web visitor is a surfer or introducing duplicate ownership, alert, routing, session, analytics, or release systems.

The native retention hypothesis is explicit: Quiver earns a return by remembering and explaining a watched call—not by reducing session-log friction again.

## Current Status

Phase: 20.1  
Plan: 20.1-06  
Status: Executing — implementation and web release are complete. Web `prod` is at `52f9603ee`,
the Phase 20.1 and native-analytics migrations are applied, and the corrected install-to-paid
report passed before re-promotion. Authenticated watched-call shadow and install-attribution
issuance/redemption smoke passed; delivery is enabled only for the exact Steven/Shapan allowlist.
Native build 16 has the approved Phase 20.1 OTA, including merged #312/#313 analytics,
deterministic #309 assignment, and the Week Scout water/tide/no-best-window correction. The
release path is the existing build-16 production channel, not TestFlight. Android physical-device
receipt and #312 decision-loop completion are verified; #313 delivery attribution and the mature
#309/D1/D7 cohorts remain open. Plan 20.1-06 Tasks 1 and 2 are complete; Tasks 3 and 4 remain open. See
`quiver/docs/release/phase-20-1-retention-loop-evidence.md`.

**BFR-03, BFR-04, and BFR-05 are withdrawn.** The web follow / My Coast surface was removed on
2026-08-25 before it ever reached a user, on Steven's call. The requirement disposition and the
traffic evidence behind it are in the evidence document above.

Progress: 20 of 22 roadmap phases complete. Phase 20.1 has **6 of 7** execution lanes merged,
with the seventh partially complete:

```text
20.1-01 audit/reuse/ownership          merged
20.1-TD native cleanup train           merged
20.1-02 shared contracts               merged
20.1-03 web follow/My Coast            merged, then WITHDRAWN and removed 2026-08-25
20.1-04 exact handoff                  merged
20.1-05 native continuity/watch/return merged; released through build-16 OTA
20.1-06 evidence/rollout decision      Tasks 1-2 complete; Tasks 3-4 open
```

Merged is not equivalent to validated. Promotion, migrations, authenticated shadow smoke, exact
Android OTA receipt, and #312 physical telemetry are complete; #313 delivery evidence and mature
cohorts remain.

Phase 21 implementation is integrated and present on `prod` dark. PR #654 replaced the stale
baseline-only comparison with a restricted current-serving projection, and the obsolete clean
worktrees were retired with their branches preserved. Plan 21-05 remains partial: exactly-two-account
allowlist proof, production integrity verification, and serving activation passed on 2026-09-01. The
allowlist resolves to exactly Steven and Shapan; control remains excluded, stored baselines remain
untouched, and serving is fail-closed outside those accounts. Broad rollout remains dark; production
ingestion parity now passes, while local-scraper retirement and outcome validation remain open.

## Active Requirements

- Execute BFR-01, BFR-02, and BFR-06 through BFR-12 from `.planning/REQUIREMENTS.md`.
  **BFR-03, BFR-04, and BFR-05 are WITHDRAWN** — the web follow / My Coast surface was removed on
  2026-08-25 before release. Do not rebuild it. See
  `quiver/docs/release/phase-20-1-retention-loop-evidence.md` § "BFR-05 disposition".
- Treat the complete Phase 20.1 folder as mandatory input, especially:
  - `20.1-INFLIGHT-AUDIT.md`;
  - `20.1-TECH-DEBT-BRANCH.md`;
  - `20.1-TECH-DEBT-CLEANUP-SLICES.md`;
  - `20.1-TD-PLAN.md`;
  - `20.1-MOCKS.md`.
- ~~Locate and freeze `claude/tech-debt-audit-codex-973g1t` before finalizing native ownership, deep-link, analytics, Home, Week Scout, favorites, refresh, or watched-call contracts.~~ **DONE in 20.1-01** — see `20.1-01-SUMMARY.md`.
- ~~Verify TD-01 through TD-05 against current `quiver-native/main`; every slice must be `land`, `superseded/no-op`, or `blocked` before overlapping implementation.~~ **DONE** — dispositions recorded in `20.1-REUSE-AUDIT.md`.
- ~~Execute landed cleanup slices as isolated commits/PRs with reference scans, focused tests, typecheck, and `git revert` rollback.~~ **DONE** — the cleanup train is merged to `quiver-native/main`; see `docs/tech-debt/phase-20-1-cleanup-summary.md`. TD-03 remains deferred (no reserved simulator lane).
- Treat Home quick log, one-tap rating, session prefill, reminders, and full SessionForm as baseline/non-regression behavior, not a Phase 20.1 product surface or primary metric.
- Preserve Phase 20 exact app-link, attribution, baseline, and QA foundations.
- Preserve or explicitly retire unique branch/worktree work before touching overlapping files; merge state is not release truth.
- Preserve Phase 21's fail-closed controls; do not infer canary activation from code or environment-variable names alone.
- Preserve approval gates for deploys, production mutations, flags, outbound sends, native releases, App Store actions, payment, and entitlement changes.

## Open Gaps

### Product

- Web has broad coastal utility traffic but little durable beach ownership, intent qualification, or owned return destination.
- The surf-qualified web-to-native funnel is not measurable end to end.
- Native Home can silently reset/rerank context; the first physical Week Scout completion is proven, but sustained stability and retention evidence are not mature.
- Watch/alert adoption is too low to establish retention impact.
- One-tap sessions already exist and did not materially move retention or sales; another session-friction pass is not an open hypothesis.

### Cleanup train

TD-01, TD-02, TD-04, and TD-05 are merged. TD-03 remains explicitly deferred because no safe
simulator lane was reserved. Do not re-run the completed cleanup slices.

### Inflight and release truth

- Web `main` and `prod` include county-advisory duplicate-site recovery through `e2c00b4c` / `52f9603ee`; the required migrations are applied.
- Authenticated watched-call create/dedupe/withheld-delivery smoke and install-attribution issuance/redemption smoke passed. Delivery is enabled only for the exact two-account allowlist.
- Native #312/#313, deterministic #309 assignment, and the Week Scout correction are released on build 16 through OTA head `104532f3` (runtime `d7204dec7cc6a74be7b04ad0ccc547dc4fd42966`). Final updates are iOS `01a0620a-a8d9-7a63-a5d3-70977551168b` and Android `01a0620b-372a-7983-9611-c0f03253b4d8`. Android build 18 received the exact OTA, and #312 closed after a physical `decision_loop_completed` receipt with matching decision/install identity. #313 still requires a genuine attributed push delivery.
- Keep #309 `INCONCLUSIVE` until both arms reach at least 50 eligible viewers with complete telemetry; the single #312 receipt is not a cohort readout.
- Android 1.0.3 (17) has a locally verified production-channel APK with the #312/#313 markers and production RevenueCat key. It is debug-signed for direct installation and is not Play-ready.
- The additive Week Scout water-temperature contract and Native no-best-window fallback are merged through web PR #668 and native PR #322 and released in the final build-16 OTA. Physical Android recovery on 2026-09-02 showed Mission Beach ranked again with an 8:00–10:00 AM window, 69°F water, and a 3.4 ft rising tide after the county advisory circuit recovered.
- Phase 21 exact Steven/Shapan allowlist, integrity proof, serving activation, and production ingestion parity passed. The legacy local ingestion LaunchAgent remains registered and scheduled but was not running at the latest inspection; retirement still requires explicit approval. Broad rollout is out of scope and remains dark.
- D1 requires at least 2 days and D7 at least 8 days after actual eligible exposure; #309 requires at least 50 eligible viewers per arm.
- Dirty primary checkouts and patch-unique worktrees remain preserved. Reconciliation reduced the cross-repo total from 34 registered worktrees to eight preserved operational checkouts before this temporary tracker-correction worktree was created. Only merged or superseded trees were removed after unique notes, screenshots, migrations, and binary patches were archived under `.quiver/artifacts/worktree-reconciliation-20260901/`.
- Local branch cleanup removed six unreferenced branches proven to be ancestors of `origin/main`; checked-out, unique, and remote branches were preserved.

## Decisions Already Made

- Web is broad coastal utility/audience qualification; native remains surf-specific.
- The durable object is a beach; a surf recommendation/window is temporary context.
- ~~Web action: `Follow this beach`.~~ **SUPERSEDED 2026-08-25** — the Follow control and My Coast
  were removed. Unqualified web visitors now get no app CTA at all, which is the pre-pilot
  behavior. The surviving web action is the qualified handoff below.
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

Lanes 20.1-01, 20.1-TD, 20.1-02, 20.1-03, 20.1-04, and 20.1-05 are all merged; 20.1-03 was then
withdrawn and removed. Do not re-execute any of them. The remaining work is release and evidence:

1. Keep alert delivery bounded to the exact Steven/Shapan allowlist while production evidence accrues.
2. Preserve the completed exact-OTA/#312 proof and collect the remaining genuine #313 push-attribution,
   #309 assignment/cohort, sustained Week Scout, and purchase-recovery evidence.
3. Complete 20.1-06 Task 4 (requirement disposition + rollout decision) once cohorts mature —
   D1 needs ≥ 2 days, D7 needs ≥ 8 days after release.
4. Retire the legacy local ingestion job after explicit approval and validate Phase 21 outcomes for only Steven/Shapan; keep broad rollout dark.

Known dispositions that no later data can change: **BFR-03/04/05 withdrawn** (surface removed).
BFR-08 is implemented and distributed through the build-16 OTA; exact Android receipt and the first
physical Week Scout completion are verified. Sustained stability and retention evidence remain open.

## Accumulated Context

- Phase 20.1 was added on 2026-08-24 for anonymous beach follow, My Coast, conservative intent qualification, exact handoff, Home continuity, all-user stability, watched calls, bounded updates, and causal evidence.
- It was expanded with six behavioral mocks and an inflight/release audit.
- It was corrected after confirming one-tap sessions already existed and did not move the needle; watched-call return became the hypothesis.
- `claude/tech-debt-audit-codex-973g1t` became a mandatory local/worktree audit lane.
- TD-01 through TD-05 were added as a separate pre-implementation cleanup train with exact reference/test/rollback gates.
- Phase 21 implementation is integrated and active only for Steven/Shapan; ingestion parity passed, while local-job retirement and outcome validation remain incomplete.

## Historical Notes

Detailed earlier milestone history remains archived. Current sessions should read this file, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, the complete Phase 20.1 folder, `.planning/PROJECT.md`, and [docs/refactor-roadmap.md](../docs/refactor-roadmap.md) first.
