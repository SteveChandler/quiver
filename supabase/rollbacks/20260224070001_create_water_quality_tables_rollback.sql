-- =============================================================================
-- ROLLBACK: Remove water quality objects
-- =============================================================================
-- Reverts all objects created by:
--   20260224070000_create_water_quality_tables.sql
--
-- Drop order respects dependency chain (dependents before dependencies):
--   1. Unschedule pg_cron job (no table dependency)
--   2. beach_water_quality (depends on beaches + wq_monitoring_stations)
--   3. wq_samples (depends on wq_monitoring_stations)
--   4. wq_monitoring_stations (depends on beaches)
--
-- WARNING: This is destructive. All water quality sync data will be
-- permanently lost. Take a pg_dump backup before running in production.
-- =============================================================================

BEGIN;

-- Unschedule the monthly cleanup cron job if pg_cron is available
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.unschedule('wq-samples-cleanup');
    END IF;
END;
$$;

DROP TABLE IF EXISTS public.beach_water_quality;
DROP TABLE IF EXISTS public.wq_samples;
DROP TABLE IF EXISTS public.wq_monitoring_stations;

COMMIT;
