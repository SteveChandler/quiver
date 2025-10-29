-- Drop duplicate coordinate columns to reduce storage and eliminate confusion
-- Keep: lat, lon (canonical), geog (GENERATED for spatial queries)
-- Drop: latitude, longitude, lng, coordinates (redundant)

BEGIN;

-- Step 1: Ensure lat/lon are populated from any variant column
-- SKIP: latitude/longitude columns don't exist in current schema
-- (Already using lat/lon as canonical columns)

-- Step 2: Drop the old coordinates trigger (manually maintained geography column)
DROP TRIGGER IF EXISTS trg_set_beach_coordinates ON public.beaches;
DROP FUNCTION IF EXISTS public.set_beach_coordinates();

-- Step 3: Recreate geog column as GENERATED (if not already)
-- First check if geog exists and is GENERATED
DO $$
BEGIN
  -- Drop existing geog if it's not GENERATED
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'beaches'
      AND column_name = 'geog'
      AND is_generated = 'NEVER'
  ) THEN
    ALTER TABLE public.beaches DROP COLUMN geog;
  END IF;

  -- Add geog as GENERATED column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'beaches'
      AND column_name = 'geog'
  ) THEN
    ALTER TABLE public.beaches
    ADD COLUMN geog geography(Point, 4326)
    GENERATED ALWAYS AS (
      CASE
        WHEN lat IS NOT NULL AND lon IS NOT NULL
        THEN ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
        ELSE NULL
      END
    ) STORED;
  END IF;
END $$;

-- Step 4: Ensure GiST index on geog (may already exist)
CREATE INDEX IF NOT EXISTS idx_beaches_geog_gist
  ON public.beaches USING GIST (geog);

-- Step 5: Drop duplicate coordinate columns
ALTER TABLE public.beaches DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS longitude;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS coordinates;

-- Step 6: Add comments for clarity
COMMENT ON COLUMN public.beaches.lat IS 'Latitude in decimal degrees (-90 to 90)';
COMMENT ON COLUMN public.beaches.lon IS 'Longitude in decimal degrees (-180 to 180)';
COMMENT ON COLUMN public.beaches.geog IS 'Auto-generated geography point for spatial queries (GENERATED from lat/lon)';

COMMIT;
