# Swell Watch: production no-send installation plan

Status: draft, not executable authorization. Prepared 2026-09-05 from the isolated `orch/phase-26-swell-web` worktree at HEAD `cb6d545da0634b00ad627547352ddf614cdd328e` plus uncommitted Phase 26 changes.

## Approved local commit boundary — supersedes older pending-commit notes

The operator approved local commits only for the reviewed migration files, restored history and this plan. Restored production history is committed separately as `016597765` (`chore(db): restore five applied migration history files`). The thirteen candidate migrations and this plan are committed together; resolve that immutable revision with `git log -1 --format=%H -- docs/runbooks/swell-watch-no-send-install-plan.md` and verify each committed SQL blob against the manifest before execution. The remaining application code, tests and other worktree changes are excluded from these commits. Test evidence below was run in the full isolated worktree; these schema-only commits do not claim the uncommitted application/test harness is independently available from a clean checkout.

No push, migration application, activation, notifications or OTA publication is authorized by these commits. The plan remains non-executable until its final exact invocation, current preflight/backup and maintainer `APPROVE: <sha>` are bound and approved. Older checkpoint references to absent commit authorization are historical.

## Contract

Use existing production Supabase project `vawdnbbgawichorsjiwe` (`quiverDB`) for 30 qualifying observed days. No Swell Watch notifications, including device/test sends, during verification. No automatic activation afterward. No OTA publication. Leave unrelated notification types and existing forecast serving unchanged.

This plan covers schema installation only. Deployment, collection configuration, scheduler activation, credentials/provider entitlement, and any later policy/attestation writes need their own exact reviewed scope. Installing tables neither starts collection nor qualifies evidence. Do not insert fabricated approvals to unblock raw collection.

## Exact candidate migration set

Paths are relative to this web worktree. Apply in the order below only after final review, committed-file verification, fresh backup, drift checks, and the required approval token. These are the existing tested full-pipeline migrations, not a claim that all thirteen are necessary for raw receipt storage alone. The receipt migration references `swell_watch_observations` and replaces release/ingestion functions; do not extract its table declarations and apply an untracked partial migration.

| Migration under `supabase/migrations/` | SHA-256 |
| --- | --- |
| `20260824120000_create_swell_watch_event_pipeline.sql` | `7bfe861b4d481d1bdd9751122bfd71d8bd1b0d639b9237b55bdb3cba5a25538e` |
| `20260824130000_create_swell_watch_production_approval_authority.sql` | `42be086ea57fcd9286685cb0061f88c4be02cfe11bf29f63d910191cccfb16d9` |
| `20260904120001_add_swell_watch_v2_enqueue_dedupe.sql` | `8cb4d3d2b5a5344f2bbb16dd61fa66eeee84c5ad29ca72685dbec7e44f112b12` |
| `20260904140000_create_swell_watch_provider_run_receipts.sql` | `85b0dcee4dd0c4b929c516ba46737502c6c0a0d9181d7699377f1232b7e92f13` |
| `20260905010000_add_swell_watch_owner_attestation.sql` | `a9efd6573a40ac991ab2e3edfec7a3b57862b2fdc09c0300d621dbf8c48b1b93` |
| `20260905020000_resolve_swell_watch_event_identity.sql` | `1a5114ec4ff6a73c4ad7ae76f4c29945d7e91cb7f05f4149392f1c8001a68d99` |
| `20260905030000_retain_swell_watch_unavailable_components.sql` | `242f8e1884fdba684897414785c46f1117bacdd6ab1f2d30647b8002ddb7d1a2` |
| `20260905040000_require_current_swell_watch_run_evidence.sql` | `67ec1e230164e8b33af962349522c00399b593310410a11e952ed96bb3809cae` |
| `20260905050000_read_attested_swell_watch_run.sql` | `de462897fbe8da6844fa112c35f0acb116ec076206e1c2f7c13bd2fd5c7c3ec2` |
| `20260905060000_ingest_swell_watch_run_atomically.sql` | `f5ca9db4248b26603174b8dbd015f29401960751abcfa59031799c9ace1d13b9` |
| `20260905070000_read_swell_watch_delivery_health.sql` | `86be505c547dc264e7a2f1242b66df7974d95be3310986b44f29b670f56618f4` |
| `20260905080000_read_swell_watch_run_scope.sql` | `e9471152a45497ed25fbb5d3f37aa7bfb2388808427ed40881e68a4ede3ea10b` |
| `20260905090000_ingest_swell_watch_cohort.sql` | `0f1f676937a51ce5ca640db4a2528090aacd531ff9321a61a3372ccb68cc78e8` |

Do not apply the old dedupe version `20260904120000`: production owns that version as Weekend Scout. Do not apply the older Swell Watch email-type migration or unrelated pending migrations as part of this batch. Do not repair production migration history to make a broad `db push` succeed.

## Objects and effects

The files above are the exact SQL authority, including their indexes, constraints, triggers, RLS and grants. Principal new table groups:

- Event state: `swell_watch_observations`, `swell_watch_beach_impacts`, `swell_watch_regional_events`, `swell_watch_event_evaluations`, `swell_watch_event_state_transitions`, `swell_watch_event_impacts`, `swell_watch_event_aliases`, `swell_watch_recipient_announcements`.
- Control/release: `swell_watch_automation_control`, `swell_watch_production_approval_authority`, `swell_watch_automation_control_transitions`, `swell_watch_notification_event_bindings`, `swell_watch_provider_delivery_outcomes`.
- Receipts: `swell_watch_provider_run_issuances`, `swell_watch_provider_run_batches`, `swell_watch_provider_run_batch_scopes`, `swell_watch_provider_run_revisions`, `swell_watch_provider_run_revision_raw_responses`, `swell_watch_provider_run_revision_components`, `swell_watch_provider_run_revision_sets`, `swell_watch_provider_run_revision_set_members`, `swell_watch_provider_run_attestations`, `swell_watch_provider_run_completed_batches`.

The receipt writer, attestation/completion readers, atomic ingestion functions, event resolution/state functions and release-control functions are installed/replaced by these files. Service-role access is not owner-attestation authority. Verify each final function's grants against the migration SQL; no anonymous/authenticated write access may be introduced.

Existing shared table mutation: `notification_events` gains `notification_events_swell_watch_v2_regional_event_id_check` and `notification_events_swell_watch_v2_recipient_event_dedupe`. These apply to v2 Swell Watch payloads, but validation and non-concurrent index creation can lock/scan the shared queue. Before approval, measure relation size, active transactions/locks and acceptable maintenance duration. If unsuitable, revise and retest the migration rather than improvising SQL during execution. No historical queue deletion or reconciliation is authorized.

Existing `beaches`, `auth.users` and notification records are referenced by foreign keys/functions; do not seed fixture users, devices, events, authority or attestation rows in production. Do not run the local drill script against production.

## No-send controls

Before any collection runtime is deployed, verify its actual deployed configuration—not just repository text:

1. Swell Watch registry channels remain empty; `SWELL_WATCH_PUSH_ENABLED` remains false/unset in every worker runtime.
2. Durable automation is absent/disabled or explicitly shadow, never armed. No production push authority is inserted by this installation.
3. Raw acquisition uses the fixed server cohort and `{ "action": "acquire" }` only. The approved local route accepts cohort-only configuration and returns `prototype_unqualified`, with no completion/enqueue call. `SWELL_WATCH_ENABLED` controls collection and is not the delivery flag.
4. No completed-batch callback or delivery canary is scheduled during raw installation. Shadow evaluation must not write notification queue entries or recipient-announcement claims.
5. Record baseline and subsequent Swell Watch queue/delivery counts. Any unexpected Swell Watch enqueue/delivery is a stop condition, not successful verification. Do not disable the global notification worker or unrelated notification types.

The observation clock requires genuine qualified coverage. Raw receipts, duplicate captures, elapsed time and hashes alone do not count. Future review must address gaps and independent completed evaluations before labeling days qualifying.

## Execution prerequisites and approval boundary

- Target: production owner connection for `vawdnbbgawichorsjiwe`, role required for normal Supabase migration ownership/tracking. Confirm `current_user`, project identity and database identity before mutation; do not use `claude_migrator` or a service-role HTTP client for migrations.
- Backup artifact: `/Users/stevenchandler/phase26-backup.375aY3/quiver-pre-swell-watch.dump`, completed `2026-09-06T05:01:34.986Z`, 241,684,276 bytes, SHA-256 `d4d76f65c8501564361091f2c491fb12f7f0240d999e4533b88b1647e31229fe`. Directory mode 0700, file mode 0600, outside git. Full archive read and required table-data sections verified below. Must be replaced if execution is at or after `2026-09-07T05:01:34.986Z`; approval delays do not extend backup freshness.
- Commit/review: migration files are currently uncommitted. Required cross-review and explicit commit authorization remain outstanding; do not apply uncommitted files.
- Drift: refresh exact versions/names and all affected object definitions. Stop on changed hashes, existing conflicting objects, queue duplicates, invalid v2 rows, missing prerequisite schema or unapplied unrelated dependencies. Earlier read-only inventory is historical evidence only.
- Runner: final plan must contain a reviewed bounded invocation applying only these exact committed files with normal tracking. A broad pending-migration push is not approved by this draft. Confirm the runner's exact pending set before mutation.
- Approval: once the above fields are populated and SQL review is complete, hash the final plan text and request `APPROVE: <sha>`. Do not request approval for this incomplete draft or treat general production-target approval as the protocol token.

## Verification and recovery

Before execution, rerun the existing disposable PostgreSQL worker drill with its recording-only transport; retain command output and the exact migration hashes. It tests a local snapshot, not live schema compatibility. Review production-specific drift independently.

After each applied file, verify tracking version/name and required objects/grants. After the full batch, verify all receipt tables have RLS, owner-only attestation boundaries, no armed control/authority, and no new Swell Watch queue/delivery rows. Use metadata reads, not synthetic production writes, for this check. Store evidence without secrets or personal data.

On failure, stop collection/scheduling and preserve data and diagnostics. Each migration is transactional, but already committed preceding migrations remain installed. Do not delete the tables as a kill switch or restore the entire shared database over concurrent user writes. Prepare a separately reviewed targeted repair/rollback if needed. No table deletion is authorized here.

## Remaining work before this becomes executable

Finish full SQL/dependency and production lock-risk review; obtain authorized backup/owner access; produce and review the bounded migration invocation; commit the reviewed files when authorized; fill the actual backup evidence; obtain the final plan approval token. Then separately finish entitlement, fixed cohort/cadence, no-send deployment and qualification setup. None of those steps is satisfied by this document.

## Draft verification evidence — 2026-09-05

### Independent review findings and local fixes — 2026-09-06

Independent re-review complete: scoped schema approval, both findings resolved, no further actionable issue found in the fixes/regression tests. Reviewer independently reconfirmed all thirteen updated hashes, inspected the privilege and contention assertions, and distinguished the parent's 9/9 executed drill from reviewer source inspection. Approval does not authorize production execution. Local commit authorization is now the next gate; after commits, bind exact file versions and a current backup/preflight to the final plan and obtain its maintainer approval token.

The user-authorized independent subagent reviewed all thirteen SQL files and returned NEEDS WORK for two installation findings. P1: the first migration revoked only INSERT/UPDATE/DELETE, leaving inherited TRUNCATE/TRIGGER/REFERENCES privileges on eight append-only tables. P2: queue DDL lacked finite lock/statement timeouts. No additional installation blocker was found by source inspection; this was not permission to apply SQL or qualify provider receipts.

Local fixes: changed the runtime revocation to REVOKE ALL followed by the existing SELECT grant; added `SET LOCAL lock_timeout='2s'` and `SET LOCAL statement_timeout='30s'` inside the dedupe transaction. Updated the two manifest hashes above. Updated the static migration assertion and added real catalog privilege coverage plus a separate disposable-database lock-contention/rollback/retry test in the existing worker drill. The catalog regression failed against the old SQL (`9:true`, expected `9:false`), proving the destructive-privilege finding. Fixed-SQL rerun `bash scripts/test-swell-watch-worker-postgres.sh` PASS, exit0: 9/9 tests, 33.377s Jest / 35.18s Yarn. The contention case aborts with the expected lock-timeout error, leaves zero partial constraint/index objects, and successfully applies both after the lock clears. Reviewer confirmation is pending at this checkpoint.

PASS focused event-pipeline Jest (2 tests), typecheck (47.45s), scoped ESLint and diff check. Exact commands: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/migrations/swell-watch-event-pipeline.test.ts`; `yarn typecheck`; `node_modules/.bin/eslint --max-warnings=0 __tests__/notifications/swell-watch-worker-postgres.drill.ts __tests__/migrations/swell-watch-event-pipeline.test.ts`; `git diff --check`. No production mutation, migration application, notification, commit, push or OTA. Browser/native E2E not run; release E2E remains incomplete.

### Prerequisite and permission review — 2026-09-06 UTC

Read-only production dependency check PASS: all 21 checked columns exist across `beaches`, `profiles`, `favorite_beaches`, `alert_rules`, `user_devices`, `notification_events` and `auth.users`; `extensions.digest(text,text)` exists; all four required roles (`postgres`, `service_role`, `anon`, `authenticated`) exist. This checks presence, not every column type/default/constraint or all possible function dependencies.

Static review of the thirteen manifest files found 51 CREATE TABLE/FUNCTION names. The two apparent external helper references `ingest_swell_watch_evaluation_internal` and `swell_watch_validate_notification_release_internal` are created by earlier-function renames in the receipt migration, not missing production prerequisites. The owner-attestation migration uses SECURITY INVOKER and revokes execution from PUBLIC, anon, authenticated and service_role. The receipt migration enables RLS on all ten receipt tables and revokes direct access from those same roles; runtime uses the explicitly granted RPCs. The cohort RPC has a fixed search_path, bounded array input and service-role-only execution. No permission change was made during this review. This focused inspection is not the required independent final review of all thirteen migrations.

Commands: PASS read-only `supabase db query --linked` with an explicit VALUES list of the 21 required columns, `information_schema.columns` anti-join, `to_regprocedure('extensions.digest(text,text)')` and role inventory; PASS `git diff --check`. Only this plan changed. Existing SQL safety tests/harness assertions were inspected; no tests, E2E or production SQL mutations were run in this review increment.

#### Standalone final migration-review handoff

Review the isolated web worktree `/Users/stevenchandler/Desktop/dev/.worktrees/phase-26/quiver`, branch `orch/phase-26-swell-web`, against the thirteen exact file hashes in this plan. The separate five restored history files already exist in production and must not be reapplied. Review all final SQL definitions and grants, shared notification-queue lock impact, migration ordering, backup limitations, no-send enforcement, and the evidence from the disposable PostgreSQL worker drill. Do not claim receipt acquisition qualifies provider runs. Review is read-only: do not commit, deploy, apply SQL, arm control, create authority/attestations, send notifications or publish OTA. Return concrete findings with file/line evidence or an explicit scoped approval; identify any conditions needed before installation. The operator launches this required independent review under workspace policy. After review, obtain explicit commit authorization, bind the final plan to committed files and a still-fresh backup, then request its `APPROVE: <sha>` token. Do not substitute the successful dry run or this self-review for that gate.

### Approved connection setup and backup completed — 2026-09-06 UTC

The user explicitly approved existing database credential use for IPv4 setup, read-only migration dry run and secure backup only. `supabase link --project-ref vawdnbbgawichorsjiwe` PASS in the isolated worktree. `supabase db push --linked --include-all --dry-run` PASS and listed exactly the thirteen candidate migrations, with no seeds or roles. It applied nothing. The ignored local connection metadata now remains linked to the approved production project; the primary checkout was unchanged. Do not run a non-dry push without final review, committed files and the required migration approval token.

The installed default `pg_dump` is version14; it was not used against PostgreSQL15. Used existing `/opt/homebrew/opt/postgresql@15/bin/pg_dump` version15.14 instead. The Node launcher read the approved primary-checkout `.env.production.local` internally, passed only the required password to the child environment, validated the exact pooler hostname/project username/database, set `PGSSLMODE=require`, `PGCONNECT_TIMEOUT=20`, and `PGOPTIONS='-c default_transaction_read_only=on'`. No credential appeared in command arguments or output. Read-only metadata reported database size 4,227,339,055 bytes and owner role `postgres`.

Commands and results:

- PASS `supabase link --project-ref vawdnbbgawichorsjiwe`.
- PASS `supabase db push --linked --include-all --dry-run` — exact thirteen-file set; no SQL applied.
- PASS `mktemp -d /Users/stevenchandler/phase26-backup.XXXXXX` — private directory above; launcher umask0077.
- PASS `/opt/homebrew/opt/postgresql@15/bin/pg_dump --format=custom --compress=6 --lock-wait-timeout=10s --file=/Users/stevenchandler/phase26-backup.375aY3/quiver-pre-swell-watch.dump` — exit0, completion time above; connection provided through validated environment only.
- PASS `/opt/homebrew/opt/postgresql@15/bin/pg_restore --file=/dev/null /Users/stevenchandler/phase26-backup.375aY3/quiver-pre-swell-watch.dump` — complete archive decompression/SQL rendering without a database connection, exit0.
- PASS archive-list assertions using `pg_restore --list` — 4,843 entries; table-data sections for `public.beaches`, `public.notification_events`, `auth.users`, and `supabase_migrations.schema_migrations` present. Archive contents were not displayed.
- PASS `shasum -a 256 /Users/stevenchandler/phase26-backup.375aY3/quiver-pre-swell-watch.dump` and file/directory permission checks.

This is a database archive, not a cluster-global-role backup or Supabase Storage object backup. Archive readability is verified; a restore into another database has not been performed. Do not describe it as a full disaster-recovery rehearsal. No schema/business-data mutations, notifications, deployment, commit, push or OTA. No application/test changes or E2E run in this increment. Changed this plan and ignored local link metadata; generated the private backup outside the repositories. Final cross-review, committed migration set and exact `APPROVE: <sha>` remain outstanding. Collection and qualifying-day accounting have not started.

### CLI dry-run connection blocker

After local history reconciliation, `supabase db push --linked --include-all --dry-run` FAILED before connecting with `LegacyDbConfigIpv6Error`: IPv6 is unavailable on the current network. The CLI recommends `supabase link --project-ref vawdnbbgawichorsjiwe` to configure the IPv4 connection. The worktree's previously absent, ignored `supabase/.temp/project-ref` was temporarily populated with that non-secret project ID for this read-only dry run, then removed with a file patch after failure. The primary checkout's link was unchanged. No migration SQL or history repair ran.

Do not describe the pending-set metadata comparison as a passed CLI dry run. It remains unverified until authorized connection setup succeeds. Next required access: use the existing production database credentials securely for IPv4/pooler owner connection setup, repeat the non-mutating dry run, and obtain the fresh `pg_dump` backup in a restricted location outside git. No password or connection-secret file was opened in this increment. Do not print a credential-bearing dump dry-run script, put a password in command arguments, or treat access approval as authorization to apply migrations.

`supabase link --help`, `supabase db dump --help`, and `git diff --check` PASS. Only this plan remains changed from this increment; the temporary link file was removed. No application/SQL/test changes or test/E2E runs. The owner-access/backup approval is outstanding, as are final migration commit/review and `APPROVE: <sha>`; no acquisition, notification, deployment or OTA publication.

### Local history reconciliation completed

Restored all five remote-only files below from the production `schema_migrations.statements` records using local file patches only. Four records contained complete SQL files and were restored byte-for-byte. Humboldt contained four separate statements; preserved each statement, adding only statement separators (`;` and blank lines) to reconstruct the executable file. Existing primary-checkout email-contact and catalog-gap files independently matched their production records byte-for-byte. No migration was executed and no production tracking row changed.

| Restored migration | Local SHA-256 |
| --- | --- |
| `20260902195500_add_humboldt_city_editorial.sql` | `e001bdf22a68a7947e647dd5877db6593fa7c335ade1be4914a4d01069490ecd` |
| `20260903180000_email_contact_policy.sql` | `155525bedfbd825dbae70ec4b6975211bf21928b30fc2939c6bb6bf076ee5698` |
| `20260903200000_add_verified_catalog_gap_beaches.sql` | `0c4d4eb8ca0b1a0fa27f5034905edfd5641a3a9c8e74932cd0bbe2864a80a83b` |
| `20260903200100_index_started_cron_runs.sql` | `61d1e9bc880ba332d4df971330431a3bfbb3cb0cbb751080c16da1cebe0df2e8` |
| `20260904120000_add_weekend_scout_candidate_paging.sql` | `07475c43b94ecf13c388002d92e97eb69c8708ff92d903af8a02c0334c338280` |

Read-back comparison passed for all five files against the exact reconstruction of retrieved records. Numeric-prefix inventory now has 783 local files, no duplicate versions, all 770 observed production versions represented, and exactly thirteen pending Swell Watch versions. This closes the five version-presence gaps; it does not certify statement equivalence for the other 765 historical files, live schema equivalence, or CLI dry-run success. The restored files remain uncommitted and must accompany the reviewed integration, but are excluded from the production apply batch because production already tracks them.

Source command (PASS): `supabase --workdir /Users/stevenchandler/Desktop/dev/quiver db query --linked "SELECT version,name,statements FROM supabase_migrations.schema_migrations WHERE version IN ('20260902195500','20260903180000','20260903200000','20260903200100','20260904120000') ORDER BY version" --output json`. Local read-back equality, inventory assertions and `git diff --check` passed. Changed files: these five restored SQL history files and this plan; no application/runtime source or test assertions changed. No E2E reviewed/changed/run for history restoration; release E2E remains incomplete. No commit, push, deployment, acquisition, notification or OTA publication.

Regression command PASS: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=fixture-only SUPABASE_SERVICE_ROLE_KEY=fixture-only NEXT_PUBLIC_SITE_URL=http://localhost:3000 yarn test:unit --runInBand --silent __tests__/migrations` — 115 suites passed / 2 skipped; 698 tests passed / 3 skipped; 5.565s Jest. This exercises the existing migration assertions, not execution of all historical SQL on a fresh database. No new test assertions were added for an exact history restoration.

### Prior inventory findings (resolved by the restoration above)

Full migration inventory comparison before restoration: production had 770 tracked versions; this worktree had 778 numeric-prefix migration files, including five legacy non-14-digit versions. Exactly the thirteen manifest files were local-only. Five versions were remote-only in this worktree:

| Version | Production migration name |
| --- | --- |
| `20260902195500` | `add_humboldt_city_editorial` |
| `20260903180000` | `email_contact_policy` |
| `20260903200000` | `add_verified_catalog_gap_beaches` |
| `20260903200100` | `index_started_cron_runs` |
| `20260904120000` | `add_weekend_scout_candidate_paging` |

The initial inventory filter excluded legacy short versions; a corrected numeric-prefix comparison confirms those five older legacy files exist and are NOT drift. The five recent remote-only rows above remain genuine local history gaps. The primary checkout contains local candidates for `email_contact_policy` and `add_verified_catalog_gap_beaches`; those files have not yet been compared to production statements or copied. Next safe action: inspect canonical `schema_migrations.statements` for these five, compare any existing committed files, and backfill exact local history under the repository drift protocol. Do not mark remote versions reverted, reapply them, or change their production tracking rows.

Installed CLI help confirms `migration up` and `db push` operate on pending sets and have no per-file allowlist flag. `db push --dry-run` previews the set; `db query --file` executes SQL but does not promise normal migration tracking. Prefer the normal CLI after verified local history reconciliation, with an exact dry-run match to these thirteen files, rather than a new custom migration writer. Still requires the final committed files, actual backup and approval token.

Checks in this inventory increment (all PASS): `supabase migration up --help`; `supabase db push --help`; `supabase db query --help`; `supabase --workdir /Users/stevenchandler/Desktop/dev/quiver db query --linked "SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version" --output json`; local Node filesystem inventory matched by numeric filename prefix; `git diff --check`. Only this document changed. No tests or E2E rerun for this read-only metadata audit. No production migration or history repair performed.

No-send drill strengthened after the draft: the existing worker/PostgreSQL test now inserts a local queued v2 event with empty registry channels while the static push flag is true. It asserts persisted `processed` / `surface_disabled`, zero delivery-attempt rows, no recording-sender call, and no refetch/replay when channels are subsequently enabled. Existing static-disabled, held/shadow, genuine-evidence, concurrency and recording-only positive controls still pass. This is local enforcement evidence, not proof of deployed controls or a real provider delivery.

Changed in this increment: `__tests__/notifications/swell-watch-worker-postgres.drill.ts` and this plan; no production source or SQL changes. Reviewed the existing worker channel loop, terminal-state persistence and PostgreSQL harness. Commands: PASS `bash scripts/test-swell-watch-worker-postgres.sh` (8/8 tests, 24.698s Jest / 26.20s Yarn); PASS `yarn typecheck` (7.04s); PASS `node_modules/.bin/eslint --max-warnings=0 __tests__/notifications/swell-watch-worker-postgres.drill.ts`; PASS `git diff --check`. Browser/native E2E not run; final release E2E remains incomplete. No real notification provider is permitted by the drill; only its recording mock is used.

Read-only production preflight passed through the primary checkout's existing Supabase CLI link. `notification_events` total relation size was 1,548,288 bytes, estimated rows 1,572, observed relation locks 0, and transactions older than five minutes 0. No public `swell_watch_%` tables exist. This snapshot suggests a small queue; it does not guarantee a lock-free maintenance window or authorize index creation. Refresh immediately before the approved batch.

Exact command (PASS):

```sh
supabase --workdir /Users/stevenchandler/Desktop/dev/quiver db query --linked "SELECT json_build_object('queue_bytes',pg_total_relation_size('public.notification_events'),'estimated_rows',(SELECT reltuples::bigint FROM pg_class WHERE oid='public.notification_events'::regclass),'queue_locks',(SELECT count(*) FROM pg_locks WHERE relation='public.notification_events'::regclass),'long_transactions',(SELECT count(*) FROM pg_stat_activity WHERE xact_start < now()-interval '5 minutes'),'swell_watch_tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'swell_watch_%')) AS preflight" --output json
```

Manifest check (PASS: 13 matching files), run from the web worktree:

```sh
node -e 'const fs=require("fs"),crypto=require("crypto"),assert=require("assert");const p="docs/runbooks/swell-watch-no-send-install-plan.md";const s=fs.readFileSync(p,"utf8");const rows=[...s.matchAll(/\| `(\d{14}[^`]+\.sql)` \| `([a-f0-9]{64})` \|/g)];assert.equal(rows.length,13);for(const [,file,hash] of rows)assert.equal(crypto.createHash("sha256").update(fs.readFileSync("supabase/migrations/"+file)).digest("hex"),hash,file);console.log("PASS: all 13 migration hashes match the draft plan");'
git diff --check
```

`git diff --check` passed. Documentation only changed in this increment; no production source, migrations or test assertions changed. Reviewed the existing PostgreSQL harness setup without running it. Unit/typecheck/browser/native E2E were not rerun; full E2E remains incomplete. No production schema/business-data mutation, provider acquisition, notification, commit, push, deployment or OTA publication was performed.
