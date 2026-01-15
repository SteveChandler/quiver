-- supabase/migrations/20260114180000_add_beach_wind_thresholds.sql
-- Add per-beach wind threshold columns for unified scoring

BEGIN;

-- Add new columns for wind thresholds
ALTER TABLE beaches
ADD COLUMN IF NOT EXISTS max_wind_onshore_mph numeric,
ADD COLUMN IF NOT EXISTS max_wind_any_mph numeric;

-- Add comment explaining the columns
COMMENT ON COLUMN beaches.max_wind_onshore_mph IS 'Wind speed (mph) that degrades conditions when onshore. Default logic uses 10 if null.';
COMMENT ON COLUMN beaches.max_wind_any_mph IS 'Wind speed (mph) that is too strong regardless of direction. Default logic uses 18 if null.';

-- Populate Ocean Beach Pier with sensible defaults
-- Note: Using 'either' instead of 'any' to match the CHECK constraint on preferred_tide_direction
UPDATE beaches
SET
  preferred_tide_direction = 'either',
  max_wind_onshore_mph = 10,
  max_wind_any_mph = 18
WHERE lower(name) = 'ocean beach pier';

-- Also set defaults for a few other well-known spots
-- Reef breaks can handle slightly more wind
UPDATE beaches
SET
  max_wind_onshore_mph = 12,
  max_wind_any_mph = 20
WHERE break_type = 'reef' AND max_wind_onshore_mph IS NULL;

COMMIT;
