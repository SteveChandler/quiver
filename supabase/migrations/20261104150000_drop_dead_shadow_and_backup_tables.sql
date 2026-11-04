-- Drop tables that nothing writes or reads (DB audit 2026-11-04,
-- audits/2026-11-04-db-unused-tables.md in the workspace).
--
-- corrected_forecasts       134,372 rows; no writer on seaside main, only
--                           scripts/ml-stats.ts read it (removed here).
-- gfs_wave_shadow_forecasts last write 2026-06-18, no code refs.
-- surfline_shadow_forecasts last write 2026-06-01, no code refs.
-- beach_photos_history      last write 2026-08-31, only the e2e cleanup list.
-- _backup_* / zz_luna_test  one-off repair backups and a test table.
--
-- No inbound foreign keys, views, triggers or publications reference them.
-- Full pg_dump (schema + data) taken before applying:
--   db-backups/dead-tables-pre-drop-20261104.dump (workspace, 9.3 MB)
-- Rollback: supabase/rollbacks/20261104150000_drop_dead_shadow_and_backup_tables_rollback.sql

BEGIN;

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
