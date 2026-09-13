# Surf-session character: retrospective closed, release blocked

Recommendation: **blocked for operator release approval**, pending native device acceptance and authorized staging compatibility review. The local correctness patch is available for code review. No release was executed.

The accepted retrospective decision is final: no demonstrated predictive improvement; no closeout threshold expansion; reject the stored-period substitution; no new barrel, consistency or lull predictions. Historical notes, adjudications and diagnostic results remain frozen. Legacy scored-API numeric-frequency retirement remains a separate contract task.

## Findings fixed in this review

1. Changing one tag previously cleared confirmation for all unknown-origin draft tags. Ordinary edits now retain the uncertainty marker until the user explicitly confirms the remaining choices or clears the entire selection.
2. A legacy `waveCharacteristics`/`waveType` touched marker previously certified a restored array. Older clients could have kept an untouched forecast suggestion while editing a different tag. Nonempty drafts now require confirmation unless they carry the new local confirmation marker; genuine manual choices are preserved, not erased.
3. Added an explicit, accessible **Omit saved wave conditions** action. Confirm, revise-then-confirm, and omit all allow an otherwise valid session to save. Unrelated edits do not confirm tags. Storage round trips, time/beach changes, forecast refresh and retry payloads preserve the confirmation state.

This review changes two native production files: `src/lib/session-form-state.ts` and `src/components/session-form/session-details-fields.tsx`; modifies the state/screen tests; adds `session-character-confirmation.test.ts` and an opt-in, loopback-only `session-character-network.test.ts`. No further web production, migration or physical-rule changes were made. The complete existing patch and file inventory are identified below; unrelated changes remain untouched.

## Scope of observation integrity

Untouched **characteristic** suggestions remain unselected and submit null characteristic/quality fields. Manual selections and explicit draft confirmation survive the payload and snapshot synchronization. Unknown draft selections are blocked at both validation and payload creation until resolved.

Do not describe every submitted field or every post-release session as independent evidence. Confirmation origin is retained in local draft state but is absent from the persisted session payload and snapshot actuals. `sessions.source` describes title/test source, not observation origin. Optional forecast-feedback contexts have client-source/version fields, but do not provide complete per-session, per-tag build/origin evidence. Older clients can still submit prefilled tags. Wave height still accepts a labelled forecast estimate and persists it as `wave_height_ft` without distinguishing that origin.

The blanket criterion "no untouched forecast hint becomes an observation" is therefore established for characteristics, **not for estimated height or every historical/client path**. A separate minimal nullable provenance-field proposal is in the next-evaluation task; it is not implemented or backfilled here.

## Verification

| Gate | Result |
|---|---|
| Native state, draft, save screen, warnings and nullable contracts | PASS: 8 suites / 277 tests |
| Shared submission and Home decision-context checks | PASS: 2 suites / 15 tests |
| Native payload to real disposable PostgREST/RLS | PASS: 4 scenarios, including retries, edits, clearing and snapshot read-back |
| Local real authentication, REST creation and native HTTP edit API | PASS: untouched, manual, confirmed draft and omitted draft; clearing updates quality/tags and preserves forecast JSON/creation time |
| Web API/calibration/nullable display/scoring tests | PASS: 9 suites / 301 tests |
| Native and web TypeScript | PASS |
| New native test-file scoped ESLint | PASS |
| Final changed-native ESLint versus task base | FAIL at both: 44 findings each, no added/removed normalized findings |
| Web lint/dead-code comparison | Prior review: 4 lint warnings and 1,487 normalized Knip findings at both base/current; web production/analysis code unchanged since that comparison |
| Fresh isolated full-schema migration/RLS check | PASS |
| 10,000-row isolated backfill and history assertions | SQL completed; wrapper failed afterwards on zsh's reserved `status` variable; timing evidence retained |
| Trigger-lock probe, rolled back | PASS: `ShareRowExclusiveLock` on both tables |
| Native device E2E and actual layout | FAILED at project loading; no session form/save/warning layout acceptance |
| Authorized staging comparison | NOT RUN: no authorized staging connection/schema was available in this task |

Tests overlap across runs; do not add repeated scenario counts into a sample size. HTTP scripts exercise real network/auth/database behavior, but do not substitute for an actual native user journey. No full web build, browser visual acceptance or production write/load test was performed in this review.

### Device evidence

A dedicated iPhone 17 Pro simulator was created and booted on iOS 26.5: `7B612FE7-4778-49F7-A22E-5A7996357769`. An existing Debug simulator dev client (`app.quiversurf.mobile`, build 17) was installed. A local auth actor, loopback-only Supabase proxy, disposable PostgREST database and local Next.js server were prepared; the production-targeting Maestro session flow was not run.

The first attempt stopped at the iOS Open prompt. The second used IPv4 while Metro was listening on IPv6 localhost. After correcting those setup issues, project loading still failed: Expo reported `Could not parse Expo config: android.googleServicesFile: "./google-services.json"`. The task worktree did not provide that referenced configuration. The application UI was not reached and compatibility of the installed dev client's native runtime with this task code was not established. Screenshots and failed Maestro artifacts are retained privately. Provide an approved non-production configuration/compatible artifact, then rerun the actual session, warning and null-display journeys; do not work around this by launching production configuration.

## Database compatibility and migration risk

The isolated source was a **local** full application schema, not staging: 167 public tables and 317 policies. It retains session writer/tide/rip-risk/board/affinity triggers, ownership, grants and RLS. It also contains a local `dev_trap_session_mutations` trigger. Restore excluded database-specific cron objects, an unavailable extension-generated GraphQL function ACL, and reassignment of event-trigger ownership to a nonsuperuser. These are known local-environment qualifications, not verified staging differences.

The fresh schema test covers 100 representative backfill rows, owner/beach restrictions, anonymous and cross-user RLS, authoritative null/empty tag clearing, explicit trigger-function grants, real snapshot writers and unchanged saved forecast JSON/creation timestamps after later forecast updates. Real REST/API checks also verify retry idempotency and editing. Other actual-condition metadata may legitimately change; this is not a claim that all row-update timestamps are immutable.

The 10,000-row benchmark used mean forecast JSON size **187 bytes**, not a production size distribution. Backfill UPDATE took **276.717 ms**, commit **5.027 ms**; snapshot relation/index size rose from **9,699,328** to **17,539,072 bytes**. Cluster WAL-position growth was **20,245,992 bytes**, an upper bound that may include other local-cluster activity. Seeding took 20.3 seconds and is not migration time. No representative staging/production row count or size distribution was available; do not extrapolate these timings into an approved production budget.

`CREATE TRIGGER` acquires write-conflicting table locks on both sessions and snapshots; the migration's single transaction retains them through backfill and commit. Long-running transactions, larger payloads and concurrent load can dominate availability risk. The file itself does not set a lock timeout. Use an operator-approved bounded lock/statement timeout in the migration session, and abort rather than wait indefinitely. If staging size/contention exceeds the approved budget, prepare a separately reviewed split/backfill plan rather than silently changing this patch.

Run the supplied read-only staging preflight before approval. Compare exact trigger definitions/order, owners/search paths/ACLs, grants/RLS, tag and JSON types, constraints/indexes, existing owner/beach mismatches, migration identity and bounded aggregate sizes. Existing mismatched snapshots are not repaired by this backfill. Check every legitimate snapshot writer uses its session's owner and beach. Staging writes remain unauthorized by this task.

## Proposed rollout and rollback, not executed

1. Resolve device/runtime/configuration blockers and run all requested native journeys, including unavailable/mismatched warning contexts and nullable layouts. Obtain staging preflight evidence and approve a maintenance/timeout budget. Freeze the reviewed diff/artifact identity and obtain operator approval.
2. Apply the additive migration first using the existing migration runner with bounded session timeouts. Verify the runner's migration-history entry and exact trigger/function identity before any retry. The SQL transaction is atomic, but blindly rerunning after a successful commit fails on existing trigger names. Check history after a lost acknowledgement; do not assume it rolled back.
3. Release compatible web/backend changes, then the reviewed native artifact or compatible OTA only after verifying its runtime. No new flags or API-field removals are required. Verify permitted read-only post-release evidence and approved canaries; do not improvise production write tests.
4. Keep older-client submissions origin-unknown. Do not relabel historical rows, claim forecast improvement, or retire the separate scored-API numeric contract as part of rollout.

For rollback, prefer rolling back application artifacts while **retaining** the additive migration and captured JSON. A rolled-back native client may resume prefill behavior, so its observations remain unknown-origin. Before commit, a failed migration rolls back its own changes. After commit, if database rollback is necessary, require explicit approval: drop the session-sync trigger and snapshot-preservation trigger before dropping `public.sync_session_wave_characteristics()`, using a bounded transaction. Retain `actual_conditions.wave_characteristics` and all forecast/history data; do not remove the JSON key or recompute old forecasts. Dropping the snapshot guard also reopens the demonstrated baseline owner/session association weakness, so prefer a reviewed fix-forward or retaining that guard rather than treating database rollback as risk-free.

## Identity and handoff evidence

Web HEAD/task base: `c0fa2bfd8bbad44e7d56c1fbffd1208bbd011dcb`.
Native HEAD/task base: `68dabb8b85f20a19e7ddae2a50a6529b41de68b2`.
Both remain on their existing `orch/surf-session-character-20260908` task branches; no commit was created. A commit SHA alone therefore does not identify this patch.

Exact complete binary diffs, SHA-256 identities, per-file hashes, commands, results, database receipts and device failures are retained in the private `release-20260909` evidence directory. Historical audit/follow-up files are separately fingerprinted without modification.

- [Release identity and full file inventory](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/release-20260909/release-identity.json)
- [Exact verification commands and results](/Users/stevenchandler/Desktop/dev/.quiver/local-evidence/surf-session-character-20260908/release-20260909/verification.md)
- [Read-only staging preflight](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/docs/surf-session-character-staging-preflight.sql)
- [Separate next evaluation/provenance task, not implemented](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/surf-session-character-20260908/docs/surf-session-character-next-evaluation.md)

No push, merge, deployment, production mutation, remote migration or production flag change was performed.
