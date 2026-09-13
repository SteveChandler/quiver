# Cron index production application plan

Target: Supabase project vawdnbbgawichorsjiwe, database postgres, current_user postgres, owner connection via POSTGRES_URL_NON_POOLING. Connection credential never logged.
Authorization: user instruction “apply the cron index migration”.
Migration: supabase/migrations/20260903200100_index_started_cron_runs.sql; committed at c49332436. Original20260903180000 collides with existing email_contact_policy tracking; that existing migration remains untouched. SQL contents identical under new unused version20260903200100.
Objects affected: create public.idx_cron_runs_started_at_started on public.cron_runs(started_at) WHERE status='started'; insert only its migration-history row, in the same transaction. No cron rows changed.
Backup: /Users/stevenchandler/Desktop/dev/.quiver/backups/quiver-prod-20260903-pre-cron-index.dump,17995243bytes,sha25607a41cc9e2176bbd860d19f58ee326e788fce7917f498a40c73c3941b589647b. Completed2026-09-03T20:00:36Z; contains public.cron_runs and supabase_migrations.schema_migrations schema/data. Full archive read via pg_restore --file=/dev/null passed.
Bounded lock wait2seconds; each statement30seconds. Preconditions require postgres owner, unused migration version and absent target index. No blanket db push.
Validation: inspect index definition, validity/readiness, migration row, and read-only EXPLAIN ANALYZE BUFFERS before/after same stale-run predicate.
Rollback if subsequently authorized: bounded DROP INDEX public.idx_cron_runs_started_at_started in a new tracked rollback migration; do not alter email migration history.

Exact execution SQL:
```sql
-- The stale-run sweep filters only unfinished runs; avoid scanning completed history.
-- Rollback: DROP INDEX IF EXISTS public.idx_cron_runs_started_at_started;
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $guard$
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'Owner connection required'; END IF;
  IF EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations WHERE version='20260903200100') THEN
    RAISE EXCEPTION 'Migration version already exists';
  END IF;
  IF to_regclass('public.idx_cron_runs_started_at_started') IS NOT NULL THEN
    RAISE EXCEPTION 'Index already exists; review before applying';
  END IF;
END
$guard$;

CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at_started
  ON public.cron_runs (started_at)
  WHERE status = 'started';


INSERT INTO supabase_migrations.schema_migrations (version,name,statements) VALUES ('20260903200100','index_started_cron_runs',ARRAY[$migration$-- The stale-run sweep filters only unfinished runs; avoid scanning completed history.
-- Rollback: DROP INDEX IF EXISTS public.idx_cron_runs_started_at_started;
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX IF NOT EXISTS idx_cron_runs_started_at_started
  ON public.cron_runs (started_at)
  WHERE status = 'started';

COMMIT;
$migration$]);
COMMIT;
```
