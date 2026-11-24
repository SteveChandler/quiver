-- Drop tables that nothing writes or reads (DB audit 2026-11-04,
-- audits/2026-11-04-db-unused-tables.md in the workspace).
--
-- corrected_forecasts       134,372 rows, last write 2026-04-24; no writer on
--                           seaside main, only scripts/ml-stats.ts read it
--                           (removed here).
-- gfs_wave_shadow_forecasts last write 2026-06-18, no code refs.
-- surfline_shadow_forecasts last write 2026-06-01, no code refs.
-- beach_photos_history      last write 2026-08-31, only the e2e cleanup list.
-- _backup_* / zz_luna_test  one-off repair backups and a test table.
--
-- No inbound foreign keys, views, triggers or publications reference them.
-- Full pg_dump (schema + data) taken before applying:
--   db-backups/dead-tables-pre-drop-20261104.dump (workspace, 9.3 MB)
-- Rollback: supabase/rollbacks/20261104150000_drop_dead_shadow_and_backup_tables_rollback.sql
--
-- The guard refuses to drop anything if a row count differs from the dump,
-- so rows written after the backup can't be lost.

BEGIN;

DO $$
DECLARE
  expected constant jsonb := '{
    "corrected_forecasts": 134372,
    "gfs_wave_shadow_forecasts": 28783,
    "surfline_shadow_forecasts": 10296,
    "beach_photos_history": 13459,
    "_backup_baja_beaches_20260827": 7,
    "_backup_beach_timezones_20260820": 9,
    "_backup_beach_timezones_fl_20260820": 2,
    "_backup_baja_beach_photos_20260827": 0,
    "zz_luna_test": 0
  }';
  t text;
  actual bigint;
BEGIN
  FOR t IN SELECT jsonb_object_keys(expected) LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', t) INTO actual;
    IF actual <> (expected ->> t)::bigint THEN
      RAISE EXCEPTION 'public.% has % rows, dump has %; re-dump before dropping',
        t, actual, expected ->> t;
    END IF;
  END LOOP;
END
$$;

DROP TABLE IF EXISTS public.corrected_forecasts;
DROP TABLE IF EXISTS public.gfs_wave_shadow_forecasts;
DROP TABLE IF EXISTS public.surfline_shadow_forecasts;
DROP TABLE IF EXISTS public.beach_photos_history;
DROP TABLE IF EXISTS public._backup_baja_beaches_20260827;
DROP TABLE IF EXISTS public._backup_beach_timezones_20260820;
DROP TABLE IF EXISTS public._backup_beach_timezones_fl_20260820;
DROP TABLE IF EXISTS public._backup_baja_beach_photos_20260827;
DROP TABLE IF EXISTS public.zz_luna_test;

COMMIT;
