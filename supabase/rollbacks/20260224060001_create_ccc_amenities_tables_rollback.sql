-- =============================================================================
-- ROLLBACK: Remove CCC Coastal Commission amenities objects
-- =============================================================================
-- Reverts all objects created by:
--   20260224060000_create_ccc_amenities_tables.sql
--
-- Drop order respects dependency chain (dependents before dependencies):
--   1. Refresh function (depends on mv)
--   2. Materialized view (depends on both tables)
--   3. beach_amenity_sources (depends on ccc_access_locations + beaches)
--   4. ccc_access_locations (base table)
--
-- WARNING: This is destructive. Any CCC sync data will be permanently lost.
-- Take a pg_dump backup before running in production.
-- =============================================================================

BEGIN;

DROP FUNCTION  IF EXISTS public.refresh_mv_beach_amenities();
DROP MATERIALIZED VIEW IF EXISTS public.mv_beach_amenities;
DROP TABLE IF EXISTS public.beach_amenity_sources;
DROP TABLE IF EXISTS public.ccc_access_locations;

COMMIT;
