-- Fix NDBC timestamps that were incorrectly set to year 4026 instead of 2026
-- This happened because NDBC switched from 2-digit to 4-digit years

BEGIN;

-- Fix all timestamps in year 4000+
UPDATE marine_forecasts
SET ts = ts - interval '2000 years'
WHERE ts >= '4000-01-01'::timestamptz;

-- Log how many were fixed
DO $$
DECLARE
  fixed_count INTEGER;
BEGIN
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RAISE NOTICE 'Fixed % marine_forecasts timestamps', fixed_count;
END $$;

COMMIT;
