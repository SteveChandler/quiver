-- Rollback: remove wind_direction_deg from enhanced_forecasts
--
-- WARNING: This is destructive (drops column). Intended only for rollback scenarios.

BEGIN;

ALTER TABLE public.enhanced_forecasts
  DROP COLUMN IF EXISTS wind_direction_deg;

COMMIT;
