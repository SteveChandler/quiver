-- Migration: Drop wavecast_reports table
-- Description: Remove unused WaveCast expert forecast integration.
-- The scraper was not running reliably (only 2 rows ever populated)
-- and the forecast weighting adjustments were negligible.

DROP TRIGGER IF EXISTS set_wavecast_reports_updated_at ON public.wavecast_reports;
DROP FUNCTION IF EXISTS public.update_wavecast_reports_updated_at();
DROP TABLE IF EXISTS public.wavecast_reports;
