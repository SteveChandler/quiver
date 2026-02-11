-- Rollback: Remove pg_cron ML backfill job and functions
-- Run this to undo migration 20260122002142_add_pg_cron_ml_backfill.sql

BEGIN;

-- Remove the pg_cron job if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'cron' AND p.proname = 'unschedule'
  ) THEN
    PERFORM cron.unschedule('ml-backfill-observations');
    RAISE NOTICE 'pg_cron job "ml-backfill-observations" unscheduled';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not unschedule job (may not exist): %', SQLERRM;
END $$;

-- Drop the functions
DROP FUNCTION IF EXISTS get_ml_health_metrics();
DROP FUNCTION IF EXISTS backfill_ml_observations_batch(INT);

COMMIT;
