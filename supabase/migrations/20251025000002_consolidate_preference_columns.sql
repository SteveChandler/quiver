-- Consolidate duplicate wind/tide preference columns
-- Standardize on: wind_cross_shore_ok_kt, wind_onshore_bad_kt, preferred_tide_ft_min/max
-- Drop: wind_cross_ok_kts, wind_onshore_bad_kts, tide_min_ft, tide_max_ft

BEGIN;

-- Step 1: Backfill standardized columns from duplicates (if they have data)
-- SKIP: Old column names don't exist in current schema
-- (Already using standardized column names: wind_cross_shore_ok_kt, wind_onshore_bad_kt,
--  preferred_tide_ft_min, preferred_tide_ft_max)

-- Step 2: Consolidate aspect/orientation columns
-- Standardize on: aspect_deg (shoreline aspect), wind_offshore_deg
-- SKIP: Old column names (shoreline_aspect_deg, offshore_deg) don't exist in current schema

-- Step 3: Drop duplicate columns
ALTER TABLE public.beaches DROP COLUMN IF EXISTS wind_cross_ok_kts;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS wind_onshore_bad_kts;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS tide_min_ft;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS tide_max_ft;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS shoreline_aspect_deg;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS offshore_deg;

-- Step 4: Add descriptive comments
COMMENT ON COLUMN public.beaches.aspect_deg IS 'Shoreline aspect in degrees (0-360, where 0=North)';
COMMENT ON COLUMN public.beaches.wind_offshore_deg IS 'Optimal offshore wind direction in degrees (0-360)';
COMMENT ON COLUMN public.beaches.wind_cross_shore_ok_kt IS 'Maximum acceptable cross-shore wind speed in knots';
COMMENT ON COLUMN public.beaches.wind_onshore_bad_kt IS 'Minimum onshore wind speed that degrades conditions (knots)';
COMMENT ON COLUMN public.beaches.preferred_tide_ft_min IS 'Minimum preferred tide height in feet';
COMMENT ON COLUMN public.beaches.preferred_tide_ft_max IS 'Maximum preferred tide height in feet';

COMMIT;
