-- Proposed read-only staging preflight. No remote execution occurred in this task.
BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SET LOCAL lock_timeout = '1s';

SELECT current_database(), current_user, current_setting('server_version');

SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, c.relrowsecurity,
       c.relforcerowsecurity, c.reltuples AS estimated_rows,
       pg_total_relation_size(c.oid) AS total_bytes
FROM pg_class c
WHERE c.oid IN ('public.sessions'::regclass, 'public.session_forecast_snapshots'::regclass);

SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS data_type,
       a.attnotnull
FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
WHERE c.oid IN ('public.sessions'::regclass, 'public.session_forecast_snapshots'::regclass)
  AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

SELECT tgrelid::regclass AS relation, tgname, tgenabled,
       pg_get_triggerdef(oid) AS trigger_definition
FROM pg_trigger
WHERE tgrelid IN ('public.sessions'::regclass, 'public.session_forecast_snapshots'::regclass)
  AND NOT tgisinternal;

SELECT p.oid::regprocedure AS function, pg_get_userbyid(p.proowner) AS owner,
       p.prosecdef, p.proconfig, p.proacl, pg_get_functiondef(p.oid)
FROM pg_proc p
WHERE p.oid IN (
  SELECT tgfoid FROM pg_trigger
  WHERE tgrelid IN ('public.sessions'::regclass, 'public.session_forecast_snapshots'::regclass)
    AND NOT tgisinternal
);

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('sessions', 'session_forecast_snapshots');

SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name IN ('sessions', 'session_forecast_snapshots');

SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid IN ('public.sessions'::regclass, 'public.session_forecast_snapshots'::regclass);

SELECT tablename, indexname, indexdef FROM pg_indexes
WHERE schemaname = 'public' AND tablename IN ('sessions', 'session_forecast_snapshots');

-- Aggregate only; do not export session identifiers or notes. This bounded query
-- can time out on a large installation: retain that as a result, do not remove
-- the timeout or run production load tests to obtain a number.
SELECT count(*) AS snapshots,
       count(*) FILTER (WHERE s.id IS NULL) AS missing_sessions,
       count(*) FILTER (WHERE s.id IS NOT NULL AND
         (s.user_id IS DISTINCT FROM f.user_id OR s.beach_id IS DISTINCT FROM f.beach_id)) AS identity_mismatches,
       count(*) FILTER (WHERE s.user_id = f.user_id AND s.beach_id IS NOT DISTINCT FROM f.beach_id AND
         (f.actual_conditions -> 'wave_characteristics') IS DISTINCT FROM
         COALESCE(to_jsonb(s.wave_characteristics), 'null'::jsonb)) AS backfill_candidates,
       avg(pg_column_size(f.forecast_snapshot)) AS mean_forecast_json_bytes
FROM public.session_forecast_snapshots f LEFT JOIN public.sessions s ON s.id = f.session_id;

ROLLBACK;
