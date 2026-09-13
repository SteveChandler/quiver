# No-send evaluation schema installation — 2026-09-06

Status: approved schema installation and read-only postflight passed.

Approval: `6851f70b837c5dfdf8329ef33da6d76f8747259625880cc3b29a5359b63a0104`, received explicitly from the maintainer.
Plan: `docs/runbooks/swell-watch-no-send-evaluation-install-plan.md`, unchanged.
Scoped commit: `a69b0149faee074c1055bbeedeb271e0a798c849` on `orch/phase-26-swell-web`, parent `17d1b45e2edf47b8dee203c0a9d3742e86ae6faf`.
Exactly the plan and its three named migrations committed; all other dirty work preserved. Normal hooks passed (secret scan and 14 checks); baseline-branch warnings were emitted. No push.

## Preflight

- PASS working, staged, and committed plan/SQL SHA-256 comparisons against the approved allowlist; empty index before staging; exact four-file commit.
- PASS selected backup: `/Users/stevenchandler/phase26-backup.375aY3/quiver-pre-swell-watch.dump`, 241684276 bytes, mode 0600, SHA-256 `d4d76f65c8501564361091f2c491fb12f7f0240d999e4533b88b1647e31229fe`; `pg_restore --list` readable. Existing completion time `2026-09-06T05:01:34.986Z`; approval/backup expiry `2026-09-07T05:01:34.986Z`.
- PASS `supabase db push --linked --include-all --dry-run`: exactly versions `20260906140000`, `20260906150000`, `20260906160000`; no seeds or roles.
- Linked project `vawdnbbgawichorsjiwe`, database/role `postgres`/`postgres`.
- An initial read-only aggregate query FAILED because it incorrectly selected `epoch` from the seed control table. Inspected the committed schema and corrected the query to check the seed plus transition ledger. No production mutation or drift repair occurred.
- PASS corrected SELECT at `2026-09-06T18:47:59.970359Z`: disabled seed, reason `phase_26_initial_fail_closed`, zero control transitions (epoch zero), zero authority/attestation/completed batches, one all-version Swell Watch queue row, zero v2 rows, two historical delivery attempts. All four new tables absent; zero other transactions older than five minutes and zero conflicting shared-relation locks in the sampled set.

## Application and postflight

PASS `supabase db push --linked --include-all`, exit zero, exactly the three approved migrations applied. The installed CLI did not present an interactive confirmation prompt; no `--yes`, seed/role option, ad hoc mutation or retry was used.

PASS read-only catalog checks against the committed SQL:

- Four tables: expected 3/9/5/3 columns, types, nullability and defaults; all constraints validated; all five indexes valid. Inspected every constraint definition including policy numeric thresholds, JSON presence/type checks, finite policy dates, primary keys and foreign keys.
- All four tables owned by postgres, RLS enabled, owner-only ACL. Effective SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privilege check for anon/authenticated/service_role returned zero unexpected grants.
- Three expected BEFORE INSERT/UPDATE/DELETE row triggers enabled, with exact expected trigger functions; no user trigger on the lease.
- Seven function signatures, return types, security modes, search paths and ACLs match SQL. Owner postgres throughout; guard is invoker, other six definer; matching-policy getter and guard owner-only, other five service-executable, no PUBLIC/anon/authenticated grant.
- All seven remote `md5(prosrc)` values match the exact dollar-quoted bodies extracted from the SHA-256-verified committed SQL (MD5 used only for equality of catalog body representation, not approval identity):

| Function | Body equality digest |
| --- | --- |
| try_acquire_swell_watch_collection_lease | df7553cdf982b62037a0f57d1b2d5a37 |
| release_swell_watch_collection_lease | 56964204e88359f856464e983394d796 |
| record_leased_swell_watch_provider_run_receipt | ef4dd7a7b6c4f06c9495a48734ce6115 |
| guard_swell_watch_evaluation_policy | 3f567738db8d4333f315b16b5794602b |
| swell_watch_get_matching_policy | 3cd1582713fd473e0a4701a969e50483 |
| resolve_and_ingest_swell_watch_evaluation | 8bf99819fbd84ff7241ac0fec8f05ff0 |
| record_swell_watch_shadow_demand | b808e02da343599d400169d22ceb8646 |

PASS final aggregate SELECT at `2026-09-06T18:49:45.461522Z`: all four new tables empty; disabled initial control and zero transitions; authority, attestations and completed batches empty; historical baseline unchanged at one queue row and two delivery attempts. Tracking versions/names match all three files.

PASS final `supabase db push --linked --include-all --dry-run`: up to date, migrations/seeds/roles all empty. No migration-history repair, rollback, data deletion or notification occurred.

## Commands and validation scope

Commands run include `git diff --cached --check`, explicit four-path `git add`, `git commit -m 'feat(db): add no-send swell evaluation support'`, `git show <staged-or-HEAD-path> | shasum -a 256` for each approved file, `stat -f '%z %Lp' <selected-backup>`, `shasum -a 256 <selected-backup>`, `/opt/homebrew/opt/postgresql@15/bin/pg_restore --list <selected-backup>`, the dry-run/apply commands above, and `supabase db query --linked <read-only SELECT> --output json` for preflight/catalog/function/baseline checks. Exact SQL and command output are retained in this task's tool transcript. The sole failed diagnostic was the corrected preflight column query described above.

No application/test source was changed during installation; only the approved four files were committed, and this uncommitted receipt was added. Existing local ten-case PostgreSQL drill and full web unit result (1,414 suites / 17,999 tests) are prior implementation evidence, not newly rerun production tests. No E2E reviewed/run in this installation; final release E2E remains incomplete.

No application deployment, runtime configuration, policy/attestation write, acquisition, notification, activation, or OTA is included. Actual deployed flags are not inferred from schema state. Qualifying observation has not started. Provider entitlement/qualification, operational policy/cohort and runtime launch remain uncompleted and outside this token.
