# Swell Watch no-send launch review

Status: operator launch authorization received; acquisition-only final review PASS.
Not activation or study-start evidence.

## Final independent review — 2026-09-06

The explicitly requested `phase26_final_launch_review` subagent (gpt-5.6-sol,
ultra reasoning) returned acquisition-only PASS bound to manifest
`55b39945e11a89b425ea6592ed5445b90a814fd40826889fc9fb818a6603ff31`.
All 58 source hashes and exact membership, plus plan/config/install/revoke hashes,
matched. This supersedes the outstanding-review statements in the historical
authorization receipt below. No additional operator approval is needed for the
unchanged bounded plan; live execution prerequisites still apply.

The review found a P1 blocker for later study evaluation, not acquisition: the
exact pending_review policy is rejected by impact-evaluator.ts:96 as
`invalid_provisional_policy`, then suppressed by attested-run.ts:84. Keep
SWELL_WATCH_SHADOW_EVALUATION_ENABLED=false. Fixing evaluation requires separate
source/configuration review; never relabel policy provenance merely to bypass it.

Reviewer verification: 11 focused Jest suites / 119 tests PASS; manifest/artifact
hashes and git diff --check PASS. SQL subreview's receipt PostgreSQL harness PASS.
Event-pipeline harness FAILED before assertions with a disposable PostgreSQL
socket-readiness race; cleanup completed. Two delegated typecheck attempts were
terminated without diagnostics, so no new typecheck pass is claimed. No browser
or native E2E was run. Reviewer changed no files and performed no production writes.
Full review and exact reproduction command are retained in the task transcript.

Next: execute the frozen approved launch sequence. Do not count raw receipts as
qualifying evaluations or claim the 30-day study has started.

Changed-target follow-up review PASS: main advanced to
`09af7f0bf0e865fb18613334e708050bc352c49c` (PR #700). Its eight water-quality/map
files have zero overlap with the 58-file manifest; upstream patch application
check and indirect contract review passed. The independent reviewer confirms the
acquisition-only review remains valid for an ordinary feature PR into this main.
No rebase or source change was needed. This does not authorize unrelated production
promotion of PR #700. Main CI run 34062105393 passed; feature PR CI remains required.

## Operator authorization received — 2026-09-06

The frozen plan is `../runbooks/swell-watch-no-send-runtime-launch-plan.md`,
SHA-256 `07515f22e3918d16b75f9ca93a838fe8150afb659a5bb7bcbb581d84a9758554`.
Steven supplied the exact `APPROVE: 07515f22e3918d16b75f9ca93a838fe8150afb659a5bb7bcbb581d84a9758554`
in this task. Authorization is recorded and must not be requested again for the
unchanged bounded plan. The frozen plan has not been edited.

Post-approval checks passed: all 58 source-file hashes and exact non-documentation
changed-file membership; plan/config/install/revoke hashes; `git diff --check`.
`git ls-remote origin refs/heads/main refs/heads/prod` returned the same heads
listed below. `gh run list --branch main --limit 3 --json databaseId,status,conclusion,headSha,name`
reported successful completed Prod Gate run 34055676116 at the current main head.
That is base-branch CI, not CI for this uncommitted package.

The required final review is not recorded for this exact current-base package.
Existing independent-agent reports cover earlier schema authorization and original
Phase 26 increments, not this 58-file inventory. The workspace operator policy
requires a separately launched Sol Ultimate final review before integration; this
session cannot claim that identity or substitute the older reviews. No commit,
push, deployment, backup/credential access, policy write or acquisition was
performed in this approval turn. No production state has been changed.

Reviewer handoff: open this worktree on `orch/phase-26-no-send-current`, read the
frozen launch plan and source manifest, and review the exact 58-file diff plus
configuration/install/revoke SQL and validation evidence. Record findings and
disposition bound to the manifest hash. Review is read-only: do not alter the frozen
artifacts, deploy, attest provider runs, enable sends or publish OTA. Return the
review here; the existing operator authorization covers the unchanged plan after
that prerequisite passes. No new code or E2E tests were changed or run this turn.

Final read-only boundary check: current registry `swell_watch.channels` is empty;
the reviewed acquisition/shadow paths return zero enqueues and do not call the
notification dispatcher. This confirms local source state only, not deployed
configuration. Plan hash recheck and `git diff --check` passed. Full provider
qualification/native/release requirements are not waived by this launch plan.

## Source and verified boundary

Worktree: `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/no-send-current`
Branch: `orch/phase-26-no-send-current`; base `8813c02df5b43744106fd0eab8e50c48685f57c5`.
Changes remain uncommitted. Freeze the final reviewed diff before requesting
commit/push/deployment approval. Do not deploy the earlier package or its local
build artifact. Current main/prod heads must be rechecked before promotion.

Prepared local review artifacts (not approval):

- `swell-watch-no-send-source-manifest.json`: 58 changed runtime/test/schema
  files, each with SHA-256, bound to the base above. Canonical sorted file-list
  hash `55b39945e11a89b425ea6592ed5445b90a814fd40826889fc9fb818a6603ff31`.
  Documentation is excluded from this source-file list, explicitly not from review.
- `swell-watch-no-send-producer-config.json`: exact ten-member cohort copied
  from the read-only inventory plus the pending-review policy. File SHA-256
  `f8d3549aec17646288a8a00bb174075973f2ab461b7506315c5c5aab5784d977`.
  Validated against the actual acquisition schema (ten-member cap) and policy
  hash verifier; pending-review provenance and null approval evidence retained.
- Live `git ls-remote` recheck still reports main `8813c02df5b43744106fd0eab8e50c48685f57c5`
  and prod `b087d1ac0ebb41f96ea14c5e1b65bb486e8b75ac`. No new reconciliation needed
  at this check. Recheck before actual promotion.

Any source/config edit invalidates the corresponding inventory hash until
regenerated and reviewed. These hashes prove byte identity only, not correctness,
provider qualification, policy approval or a completed study.

See `swell-watch-package-validation.md` for actual commands, test coverage,
restricted-data build warnings and limitations. Local default-off HTTP passed;
enabled production acquisition and qualified evaluations have not been proved.

## Proposed operational sequence

1. Preserve unrelated notification jobs. Explicitly set `SWELL_WATCH_ENABLED=false`
   and `SWELL_WATCH_PUSH_ENABLED=false`; verify deployed behavior, not only env
   names. Keep Swell Watch send authority disabled throughout the study and after
   its end. Do not change notification worker/global delivery flags.
2. Deploy reviewed source with `SWELL_WATCH_ACQUISITION_ENABLED=false` and
   `SWELL_WATCH_SHADOW_EVALUATION_ENABLED=false`. The new Vercel schedule calls
   GET `/api/cron/swell-watch-acquire` hourly at minute 15; disabled responses do
   not fetch provider forecasts. Existing daily legacy route remains unchanged.
3. Install only the reviewed ten-public-beach cohort and evaluation-policy JSON
   in `SWELL_WATCH_PRODUCER_CONFIG`. The proposal and exact UUID/region pairs live
   in the original Phase 26 web worktree's
   `docs/runbooks/evidence/swell-watch-operational-inventory-20260906.md` and
   `docs/operations/swell-watch-no-send-policy-proposal.json`.
   Proposed value hash: `4c9ec372e9dff824039956ef5d2f46e6d3445b9d0d80d6626cac9932de436ecd`.
   This pending-review policy is not permission to send. Do not invent approval
   evidence, change its provenance to production-approved, or silently drop a beach.
4. Under the separately reviewed owner-write plan, insert the evaluation-policy
   ledger row with exact policy values/hash, real reviewer/evidence hash, next
   epoch, and explicit start/expiry. No new schema application is required by
   the dated installation receipts. Do not seed push authority.
5. Enable acquisition only, perform one controlled invocation, and inspect its
   receipts and `cron_runs.summary`. It must report `prototype_unqualified` and
   `enqueued=0`. The existing lease and 240-second provider deadline bound
   overlap/work; failures retry at the next scheduled invocation, not a tight loop.
6. Review actual retained provider evidence before owner attestation. Required:
   response-to-issuance binding, full requested scope/component coverage,
   serving relevance, source continuity/provenance and applicable provider usage
   conditions. A receipt hash, availability timestamp or repeated fetch is not
   qualification. Reject insufficient evidence; never auto-accept it to start a clock.
7. Use the existing owner-only `attest_swell_watch_provider_run` decision RPC,
   then `complete_swell_watch_provider_run_receipt` for that accepted revision.
   Exact retries retain identity. Do not give service_role attestation privileges.
8. Enable no-send evaluation and POST only the completed `provider_batch_id` to
   `/api/cron/swell-watch-evaluate`. This POST callback is deliberately not a
   Vercel GET cron. Owner qualification/completion and callback invocation remain
   an explicit operational procedure; acquisition does not invoke them.
9. Record evaluated and suppressed outcomes, exact identities/policy hashes and
   missingness. Only genuine qualifying observations count toward 30 days.
   Zero candidates and missing demand are different. Never count cron HTTP 200
   or repeated receipt identity as an independent completed evaluation.

## Holds and rollback

- No Swell Watch sends on any device; no OTA publication or automatic activation.
- Stop acquisition/evaluation by setting their two flags false and verifying
  disabled responses. Preserve evidence tables; do not drop tables as rollback.
- Revoke incorrect attestations explicitly using the existing owner procedure.
  Revoke/expire the evaluation policy through its append-only ledger, not DELETE.
- Failed scope, missing components, timeout, unavailable authority or invalid
  policy stays suppressed. Do not lower evidence standards to keep a schedule green.
- Free provider only: no purchase, customer endpoint or subscription is authorized.
  Whether retained evidence meets usage and qualification requirements remains
  unresolved; this plan does not assert commercial entitlement.

## Remaining launch-review work

Owner-write drafts are now `swell-watch-no-send-policy-install.sql` and
`swell-watch-no-send-policy-revoke.sql`. Both passed the local execution checks
below; neither has been executed in production. The exact launch approval now
authorizes their bounded execution after the required review and backup gates.
Local execution test completed successfully under session 86548. It reused the existing
worker-drill bootstrap and cleanup, with the current worktree snapshot/migrations
and original receipt fixture helper; no PostgREST or notification worker starts.
The harness runs install twice, verifies identical rows/expiry and absent send
authority, revokes twice, verifies no matching-policy fallback, and rejects an
attempted reinstall after revocation. A fixture-only baseline table lives only
inside the disposable database. Setup downloaded Supabase PostgreSQL
`15.8.1.085` (digest `sha256:af083ef64d0408c8f098ee6f5c364a59b26f36fbc0f3a334a62c5c1d57362e9b`).
The Node-driven Bash/psql harness exited 0 after cleanup. Install/retry left exactly
one identical ledger row and a 45-day interval, matching-policy lookup returned
one row, revoke/retry left exactly two rows and no matching-policy fallback.
Attempted reinstall failed specifically with `Policy is not a live initial
install; do not renew implicitly`; the ledger remained at two rows. No production
authority, armed control, or notification event was introduced. These are actual
SQL assertions against the current migrations, not mocked RPC responses.
Post-run `docker ps -a --filter name=phase26-worker --format '{{.Names}} {{.Status}}'`
returned no containers. The harness removed only its disposable database/data and
temporary workspace; those test records are intentionally discarded and can be
recreated. Shared development/production databases were not modified.
`git diff --check` passed. No new runtime/test files or browser/native E2E changes
in this verification turn; exact harness invocation remains in the task transcript.
They target only `public.swell_watch_evaluation_policies` using the Supabase owner
connection for project `vawdnbbgawichorsjiwe`. No grants, schema, provider decisions,
push authority, notifications or user records are written.

Proposed administrative validity is **45 days from installation**, allowing
startup/missed observations around the required **30 qualifying observed days**.
This is a proposal for the consolidated review, not an already approved policy
change or permission to count 45 calendar days as evidence. No automatic renewal.
The SQL binds the exact policy values and configuration-file review hash; it
records Steven Chandler as reviewer only if he approves its execution. That
review hash concerns configuration, never actual provider qualification.

Install requires disabled send control/no live push authority, inserts epoch 1
only into an empty ledger, and permits an identical active retry without extending
expiry. Any changed/expired/revoked policy aborts. Rollback appends only the matching
epoch-2 revocation, permits an identical retry, and refuses unrelated policy state.
Both operations use the existing control advisory lock and bounded SQL timeouts.
Disable acquisition/evaluation flags first when stopping operations; preserve data.
Before production approval, bind a fresh verified backup artifact (less than 24
hours old), SQL file hashes and execution commands in the final frozen plan.

Bind a final source manifest/revision, exact cohort/configuration, owner-write SQL
with real reviewer/evidence/validity and rollback, and deployment verification to
one consolidated approval. Review enabled-path evidence and retention/operational
ownership before describing this as an unattended qualifying study. The full
Phase 26 provenance, native lifecycle, real shadow window and release gates remain.
