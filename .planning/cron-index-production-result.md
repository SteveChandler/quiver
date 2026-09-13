# Cron index applied to production

Target: Supabase vawdnbbgawichorsjiwe, database postgres, verified current_user postgres. Applied successfully under user instruction to apply the cron index migration.

Migration20260903200100/index_started_cron_runs committed and pushed to main at c49332436. The original20260903180000 was already used by email_contact_policy; renamed the unapplied cron file without changing its SQL. Existing email migration untouched. Updated local SQL verification script and two reports to the new filename. No app source changed.

Fresh scoped backup of public.cron_runs and supabase_migrations.schema_migrations: /Users/stevenchandler/Desktop/dev/.quiver/backups/quiver-prod-20260903-pre-cron-index.dump .17,995,243bytes. SHA25607a41cc9e2176bbd860d19f58ee326e788fce7917f498a40c73c3941b589647b. Archive fully read successfully; local mode0600. No backup data committed.

Execution created only public.idx_cron_runs_started_at_started and its migration-history row in one transaction. Lock_timeout2s;statement_timeout30s. Owner/version/index preconditions passed; CREATE INDEX, INSERT0 1, COMMIT succeeded. No application data rows modified.

Postflight: exact expected partial btree on started_at WHERE status='started'; indisvalid=true,indisready=true,size8192bytes. Both email and cron migration-history rows present with correct names.

Same read-only stale-run SELECT predicate before/after:
- Before: parallel sequential scan,22976 buffers,Execution Time1500.264ms.
- After: index scan,1 buffer,Execution Time0.030ms.
These are individual verification measurements with different cache states, not a throughput guarantee. Both returned0 stale rows. Current production cleanup queries can use the index immediately; no app redeployment required.

Commands (owner credentials supplied privately as child-process PG environment):
- node /tmp/quiver-cron-index-db.cjs psql -X -v ON_ERROR_STOP=1 -P pager=off -f /tmp/quiver-cron-index-preflight.sql — PASS.
- Initial default pg_dump — FAIL: installed14.17 older than server15.8; no database changes.
- node /tmp/quiver-cron-index-db.cjs /opt/homebrew/opt/postgresql@15/bin/pg_dump --format=custom --no-owner --no-acl --lock-wait-timeout=5s --table=public.cron_runs --table=supabase_migrations.schema_migrations --file=/Users/stevenchandler/Desktop/dev/.quiver/backups/quiver-prod-20260903-pre-cron-index.dump — PASS.
- /opt/homebrew/opt/postgresql@15/bin/pg_restore --file=/dev/null BACKUP — PASS.
- node /tmp/quiver-cron-index-db.cjs psql -X -v ON_ERROR_STOP=1 -P pager=off -f /tmp/quiver-cron-index-explain.sql — PASS.
- node /tmp/quiver-cron-index-db.cjs psql -X -v ON_ERROR_STOP=1 -P pager=off -f /tmp/quiver-cron-index-apply.sql — PASS; index/history committed atomically.
- node /tmp/quiver-cron-index-db.cjs psql -X -v ON_ERROR_STOP=1 -P pager=off -f /tmp/quiver-cron-index-postflight.sql — PASS.
- git diff --check; git commit; git push origin HEAD:main — PASS. Secret scan and14 guard checks passed; no hooks bypassed.

No unit/E2E tests rerun: SQL contents identical to the previously tested migration; this turn verified actual production index and query plan. No tests added. Production application release remains separate. No unresolved index-application findings. Rollback would require a separately reviewed tracked DROP INDEX migration.
