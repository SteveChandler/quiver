-- =============================================================================
-- ROLLBACK: Remove water quality notification preference column
-- =============================================================================
-- Reverts the column added by:
--   20260224070002_add_water_quality_notification_pref.sql
--
-- WARNING: Any user preference data stored in notif_water_quality will be
-- permanently lost. Take a pg_dump backup before running in production.
-- =============================================================================

ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_water_quality;
