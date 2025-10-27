-- Consolidate duplicate wind/tide preference columns
-- Standardize on: wind_cross_shore_ok_kt, wind_onshore_bad_kt, preferred_tide_ft_min/max
-- Drop: wind_cross_ok_kts, wind_onshore_bad_kts, tide_min_ft, tide_max_ft

BEGIN;

-- Step 1: Backfill standardized columns from duplicates (if they have data)

-- Wind cross-shore tolerance
UPDATE public.beaches
SET wind_cross_shore_ok_kt = COALESCE(wind_cross_shore_ok_kt, wind_cross_ok_kts)
WHERE wind_cross_shore_ok_kt IS NULL AND wind_cross_ok_kts IS NOT NULL;

-- Wind onshore bad threshold
UPDATE public.beaches
SET wind_onshore_bad_kt = COALESCE(wind_onshore_bad_kt, wind_onshore_bad_kts)
WHERE wind_onshore_bad_kt IS NULL AND wind_onshore_bad_kts IS NOT NULL;

-- Preferred tide min
UPDATE public.beaches
SET preferred_tide_ft_min = COALESCE(preferred_tide_ft_min, tide_min_ft)
WHERE preferred_tide_ft_min IS NULL AND tide_min_ft IS NOT NULL;

-- Preferred tide max
UPDATE public.beaches
SET preferred_tide_ft_max = COALESCE(preferred_tide_ft_max, tide_max_ft)
WHERE preferred_tide_ft_max IS NULL AND tide_max_ft IS NOT NULL;

-- Step 2: Consolidate aspect/orientation columns
-- Standardize on: aspect_deg (shoreline aspect), wind_offshore_deg

-- Merge shoreline_aspect_deg into aspect_deg
UPDATE public.beaches
SET aspect_deg = COALESCE(aspect_deg, shoreline_aspect_deg)
WHERE aspect_deg IS NULL AND shoreline_aspect_deg IS NOT NULL;

-- Merge offshore_deg into wind_offshore_deg
UPDATE public.beaches
SET wind_offshore_deg = COALESCE(wind_offshore_deg, offshore_deg)
WHERE wind_offshore_deg IS NULL AND offshore_deg IS NOT NULL;

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
