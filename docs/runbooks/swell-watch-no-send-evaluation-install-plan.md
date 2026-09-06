# Swell Watch no-send evaluation installation batch

Status: consolidated local-commit and production-schema approval proposal.
The previously approved thirteen-file plan and its approval hash are unchanged.

## Exact authorization boundary

Maintainer approval of this complete file's SHA-256 authorizes only:

1. One local commit containing this plan and the three exact migration files below,
   on existing branch `orch/phase-26-swell-web`, starting at
   `17d1b45e2edf47b8dee203c0a9d3742e86ae6faf`. Commit subject:
   `feat(db): add no-send swell evaluation support`.
2. The bounded preflight and three-file production schema installation below,
   followed by read-only postflight and a separate local execution receipt.

No push, application commit, deployment, configuration/flag change, collection,
policy/attestation insert, notification, activation or OTA is authorized. This is
not a claim that all release prerequisites are met or that the thirty-day window
starts. Approval expires `2026-09-07T05:01:34.986Z` with the selected backup.
If scope, file hashes, branch/base, backup or pending set differs, stop; do not
substitute another operation under this token.

Before the local commit, verify the index is empty, stage only the four named files
with explicit paths, and assert staged paths and bytes match this plan. Preserve
all other dirty work. Use normal commit hooks; if hooks alter approved bytes or
fail, stop and report rather than bypassing checks. Record the resulting commit
in the separate receipt, and verify its three SQL blobs plus plan bytes before
any production mutation. The uncommitted application/tests are not part of this
schema-only commit; reported local test evidence comes from the full worktree.

## Read-only preflight — 2026-09-06 18:26 UTC

Linked project reference matches `vawdnbbgawichorsjiwe`; remote database/role are
`postgres`/`postgres`. `supabase db push --linked --include-all --dry-run` PASS lists
exactly the three migrations below, seeds `[]`, roles `[]`. A catalog SELECT confirms
all four new tables absent. No installation was attempted.

Aggregate database SELECT at 18:26:22 UTC: control disabled/epoch 0 with
`phase_26_initial_fail_closed`; authority rows 0; attestations 0; completed batches
0; v2 queue rows 0; all-version Swell Watch queue rows 1; delivery attempts 2;
other transactions older than five minutes 0. Counts match the historical July
baseline, not zero lifetime sends. This does not verify deployed environment flags
or promise lock-free future execution.

Existing backup explicitly revalidated, not newly created:
`/Users/stevenchandler/phase26-backup.375aY3/quiver-pre-swell-watch.dump`, 241684276
bytes, mode 0600, completed `2026-09-06T05:01:34.986Z`, SHA-256
`d4d76f65c8501564361091f2c491fb12f7f0240d999e4533b88b1647e31229fe`.
`stat`, `shasum -a 256` and
`/opt/homebrew/opt/postgresql@15/bin/pg_restore --list <backup>` PASS. This archive
predates the thirteen-file installation; readability is not a restore rehearsal.
This plan explicitly selects that backup, subject to revalidation immediately
before execution. It meets the less-than-24-hour rule only until
`2026-09-07T05:01:34.986Z`. No restore is authorized. A stale or changed backup
requires a revised plan and new approval.

Execution requires the exact maintainer token, then the scoped commit and
time-of-execution preflight. Runtime provider/account configuration and deployment
are separate uncompleted work, not granted here.

## Scope

Target: existing production Supabase project `vawdnbbgawichorsjiwe` (`quiverDB`),
database `postgres`, verified production owner connection through the linked CLI.
Worktree: `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/quiver`.

Install only the three migrations below, in order. Each file is transactional with
a two-second lock timeout and thirty-second statement timeout; the batch is not
atomic across files. The files are currently uncommitted. Do not apply them until
the approved scoped local commit, backup revalidation and drift/preflight complete.
The required token is `APPROVE: <sha256>` of this complete file's exact bytes.

| Migration under `supabase/migrations/` | SHA-256 |
| --- | --- |
| `20260906140000_add_swell_watch_collection_lease.sql` | `0a2ae1ae3368a429e2791415798205fa5e2054d638df53c174d71305d11280e9` |
| `20260906150000_separate_swell_watch_evaluation_policy.sql` | `543ce6ef45b48c82c8cc8e366e9a3e0aa2764dbcede467f2cef4264e558a51c2` |
| `20260906160000_record_swell_watch_shadow_demand.sql` | `732f1083af6b265b4ae1aab3ec18f6aae95f35dd77c755084b7c5594c539d841` |

## Effects and restrictions

- Lease table plus service-only claim, token-matched release and fenced receipt
  writer. The only DELETE is inside the release function, keyed by singleton ID
  and owner token; installation invokes no release and deletes no data.
- Owner-only append-only evaluation-policy table, epoch guard and internal matching
  policy getter. Replaces the existing resolver only to use this getter. An empty
  evaluation ledger preserves legacy push-policy lookup; a present but invalid,
  revoked or expired latest evaluation policy never falls back to push authority.
- Append-only shadow-demand run/pair tables and time index; service-only recording
  RPC checks completed/current provider evidence and matching policy. Per-run
  audience snapshots are immutable. First-seen pairs count across a rolling 24 hours
  without refreshing old pairs. This is recorded pre-safety demand, not send
  eligibility or complete observed coverage.

All four new tables enable RLS and deny direct access to PUBLIC, anon,
authenticated and service_role. Service roles receive only specified RPC execution;
matching-policy/guard functions remain internal. The migrations reference existing
provider/event tables and `auth.users` through foreign keys; this can acquire locks
on shared relations even though no user rows are rewritten. No queue schema or
release/worker function changes, seeds, policy rows, attestation rows, authority
rows, runtime flags, schedules, deployments, sends or OTA publication are included.

## Required final preflight

1. Confirm committed and working-tree hashes equal the allowlist; preserve unrelated
   work and do not repair migration history to make a broad push succeed.
2. Revalidate linked project/owner and all migration versions. A read-only
   `supabase db push --linked --include-all --dry-run` must list exactly this set.
   If effects already exist, stop and classify drift rather than rerunning DDL.
3. Verify the explicitly selected `pg_dump` backup remains less than 24 hours old,
   readable and hash-matching. Record its path, checksum, completion time and plan
   expiry as specified above. Stop if stale; the dated check is not permission to
   reuse it after expiry or silently select another artifact.
4. Check shared relation locks/long transactions, all-version Swell Watch queue and
   delivery baseline, control still disabled/epoch 0, and authority/attestation/
   completed-batch tables still empty. The July legacy sends are historical, not
   zero lifetime sends; stop on any baseline change. No deployed runtime settings
   are changed or inferred by this schema-only operation; actual no-send runtime
   configuration must be verified before any later runtime launch.
5. Record the scoped commit and current preflight in a separate receipt; rehash this
   plan against the maintainer token. Never modify approved bytes to add results.

After the exact approval, the proposed command is
`supabase db push --linked --include-all`, confirming only the exact three-file CLI
prompt. No `--yes`, seed/role option, ad hoc SQL or automatic retry. Stop on any
error; inspect which files committed before proposing recovery.

## Postflight and recovery

Verify tracking names/versions, all four tables, columns/constraints/indexes, three
triggers, seven function bodies/signatures, ownership, RLS and grants against the
committed SQL. Require new tables empty immediately after schema-only installation,
unchanged authority/control and unchanged all-version notification baseline. Do not
mark success from table existence alone. Record a separate dated execution receipt;
do not rewrite the approved plan bytes.

On failure leave acquisition/evaluation/sending disabled and retain any committed
schema/evidence. A targeted rollback, if needed, restores the preceding resolver
definition under separate review/approval; do not drop evidence, reset dedupe or
restore the whole production database automatically. Unrelated notifications must
remain operational.

## Evidence and remaining work

See `docs/operations/swell-watch-shadow-collection.md` for local real-PostgreSQL
drills, callback integration, unit tests and known release limitations. Final
post-timeout-change `bash scripts/test-swell-watch-worker-postgres.sh` passed all
ten cases (24.907 seconds Jest), exit zero with owned-container cleanup complete.
`git diff --check` passed. No TypeScript or test source changed in this batch;
browser/native E2E was not run. These checks do not measure production contention.
The disposable harness is local only; never point it at production.

This is the schema portion of no-send readiness, not the complete operating launch.
Provider entitlement and transport qualification, reviewed evaluation policy and
cohort, owner attestation/completion procedure, runtime orchestration and 30 genuinely
qualifying observed days remain required. Account-dependent customer transport may
require a further reviewed receipt-contract change; resolve that before presenting
a combined operational launch approval. No automatic activation after observation.
