# Swell Watch production schema installation — 2026-09-06

Result: the thirteen approved migrations were applied successfully to production `quiverDB` (`vawdnbbgawichorsjiwe`). Schema installation only; Phase 26 release readiness and the 30-day qualification window remain incomplete.

## Authorization and immutable inputs

- Maintainer token: `APPROVE: 67a3fa10b59f1e1a73fe26167a73906ab01f30f92c9e006eb7de742e1072c1fc`.
- Exact approved plan: `docs/runbooks/swell-watch-no-send-install-plan.md`; preserved unchanged at that SHA-256.
- SQL commit: `17d1b45e2edf47b8dee203c0a9d3742e86ae6faf`. All thirteen committed and working-tree file hashes matched its manifest immediately before execution.
- Backup: `/Users/stevenchandler/phase26-backup.375aY3/quiver-pre-swell-watch.dump`; SHA-256 `d4d76f65c8501564361091f2c491fb12f7f0240d999e4533b88b1647e31229fe`. Hash, 0600 file/0700 directory permissions and freshness passed. Backup completed 2026-09-06T05:01:34.986Z, within 24 hours of this execution. Previously verified archive readability is not a database restore rehearsal.

## Commands and results

- PASS: Node assertions over approved plan bytes, thirteen committed/local migration hashes, linked project and backup integrity/freshness.
- PASS: `supabase db push --linked --include-all --dry-run` — exactly the thirteen approved files, no seeds or roles.
- FAILED: `supabase db query --linked` preflight — temporary CLI login authentication failed. No mutation was attempted by that command.
- PASS: bounded read-only `/opt/homebrew/opt/postgresql@15/bin/psql -X -v ON_ERROR_STOP=1 -Atqc <metadata SELECT>` through the approved IPv4 owner connection — owner/database `postgres`; no existing Swell Watch tables; zero v2 rows; legacy baseline one queue row/two attempts. Credentials were passed only through child environment, never printed.
- PASS: `supabase db push --linked --include-all` — exit 0; exactly thirteen migrations reported applied, no seeds or roles. No `--yes` was used. The installed CLI did not present an interactive confirmation prompt; its applied list matched the verified dry run and approved manifest.
- PASS: bounded read-only owner/catalog assertions after application, summarized below. These checks used `PGOPTIONS='-c default_transaction_read_only=on -c statement_timeout=20000'`, a 10-second connection timeout and 30-second process timeout.

## Post-install evidence

- Thirteen expected version/name pairs exist in normal Supabase migration tracking.
- Full numeric-version inventory matches all 783 local files: zero pending and zero remote-only versions. The five restored history files were not reapplied.
- All 23 manifest-created tables exist, are owned by `postgres`, and have RLS enabled. Anon/authenticated have no table access; service role has no direct INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges.
- All 30 final function bodies, including the two renamed internal functions, hash-match the final reviewed SQL bodies after trimming outer whitespace. Owners are `postgres`. Runtime RPCs deny anon/authenticated execution; internal release/evaluation helpers deny service-role execution. Trigger functions and the pure policy validator retain their reviewed grants.
- Owner attestation is SECURITY INVOKER and denies execution to anon, authenticated and service role.
- Both explicitly declared indexes exist and are valid; the v2 queue CHECK is validated. All 25 explicitly named triggers exist and are enabled. No invalid Swell Watch-prefixed indexes were found.
- Effective control: `disabled`, epoch `0`, reason `phase_26_initial_fail_closed`. The initial control row is intentionally seeded by migration 20260824120000; no control transition occurred.
- Approval authority, control-transition, provider-batch, attestation, completed-batch and provider-outcome tables are empty.
- Zero v2 notification rows. Legacy baseline remains one processed Swell Watch row and two recorded sent attempts from July 9; no new queue/delivery records appeared.

One initial verification assertion incorrectly expected zero control rows and failed. Inspection of the committed migration confirmed the intentional disabled seed. The corrected assertion requires that exact disabled state/reason and passed; no production repair was needed or performed.

## Scope and remaining work

No application source, tests or SQL files changed in this installation turn; only this receipt was added. No additional commit, push, application deployment, acquisition scheduling, owner attestation, production policy approval, notification, activation or OTA publication occurred. Existing independent review and the most recent 9/9 local PostgreSQL drill remain prerequisite evidence; unit/E2E tests were not rerun after installation. Browser/native E2E remains incomplete.

The installation does not establish provider entitlement, qualified independent evaluations, reviewed real policy/corpus evidence, native lifecycle readiness, deployed no-send configuration, or 30 qualifying days. Collection has not started. Any subsequent runtime configuration/deployment or authority/attestation writes require their own reviewed scope and explicit approval. Preserve the Phase 25 OTA hold and the all-version, all-device no-send requirement.
