-- Run ONLY in an empty disposable database, not the shared local Supabase database.
\set ON_ERROR_STOP on
CREATE TABLE public.cron_runs (id bigint PRIMARY KEY, started_at timestamptz NOT NULL, status text NOT NULL);
INSERT INTO public.cron_runs
SELECT n, now() - interval '1 hour', CASE WHEN n <= 10 THEN 'started' ELSE 'ok' END
FROM generate_series(1, 209000) n;
ANALYZE public.cron_runs;
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.cron_runs WHERE status = 'started' AND started_at < now() - interval '15 minutes';
\ir ../supabase/migrations/20260903200100_index_started_cron_runs.sql
\ir ../supabase/migrations/20260903200100_index_started_cron_runs.sql
ANALYZE public.cron_runs;
EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM public.cron_runs WHERE status = 'started' AND started_at < now() - interval '15 minutes';
DO $$
DECLARE plan json; affected integer;
BEGIN
  EXECUTE 'EXPLAIN (FORMAT JSON) SELECT id FROM public.cron_runs WHERE status = ''started'' AND started_at < now() - interval ''15 minutes''' INTO plan;
  IF plan::text NOT LIKE '%idx_cron_runs_started_at_started%' THEN
    RAISE EXCEPTION 'Expected partial-index query plan: %', plan;
  END IF;
  UPDATE public.cron_runs SET status = 'error' WHERE status = 'started' AND started_at < now() - interval '15 minutes';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 10 THEN RAISE EXCEPTION 'Expected 10 stale runs, got %', affected; END IF;
  IF EXISTS (SELECT 1 FROM public.cron_runs WHERE status = 'started') THEN RAISE EXCEPTION 'Stale runs remain'; END IF;
END $$;
DROP INDEX public.idx_cron_runs_started_at_started;
DO $$ BEGIN
  IF to_regclass('public.idx_cron_runs_started_at_started') IS NOT NULL THEN RAISE EXCEPTION 'Rollback failed'; END IF;
END $$;
