-- Restore the tables dropped by 20261104150000_drop_dead_shadow_and_backup_tables.
--
-- The data lives in the pre-drop dump, not in this file. Step 1, from the
-- workspace root (pg_restore 15+, prod owner connection):
--
--   pg_restore --no-owner --no-privileges -d "$POSTGRES_URL_NON_POOLING" \
--     db-backups/dead-tables-pre-drop-20261104.dump
--
-- (add -t <table_name> to restore one table). The dump keeps RLS settings and
-- policies but not grants. Step 2: run the GRANT block below, which restores
-- the grants as they were on 2026-11-04.
--
-- Running this file before step 1 fails on purpose.

DO $$
BEGIN
  IF to_regclass('public.corrected_forecasts') IS NULL
     AND to_regclass('public.beach_photos_history') IS NULL THEN
    RAISE EXCEPTION 'Tables not restored yet: pg_restore db-backups/dead-tables-pre-drop-20261104.dump first';
  END IF;
END
$$;

BEGIN;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['corrected_forecasts', 'gfs_wave_shadow_forecasts',
                           'surfline_shadow_forecasts', 'beach_photos_history'] LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON public.%I TO anon, authenticated, service_role', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY ARRAY['_backup_baja_beaches_20260827', '_backup_beach_timezones_20260820',
                           '_backup_beach_timezones_fl_20260820', '_backup_baja_beach_photos_20260827',
                           'zz_luna_test'] LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    END IF;
  END LOOP;
END
$$;

COMMIT;
