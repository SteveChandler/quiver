-- Fix coordinate column migration dependency issue
-- The previous migration failed because geog column depends on latitude/longitude
-- This migration properly handles the dependency order

BEGIN;

-- Step 1: Drop the geog column and its index first to remove dependencies
DROP INDEX IF EXISTS public.idx_beaches_geog_gist;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS geog;

-- Step 2: Now we can safely drop the old coordinate columns
ALTER TABLE public.beaches DROP COLUMN IF EXISTS coordinates;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS latitude;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS longitude;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS alt_names;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS is_featured;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS popularity_score;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS shore_aspect;
ALTER TABLE public.beaches DROP COLUMN IF EXISTS swell_window;

-- Step 3: Add the new coordinate columns
ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;
ALTER TABLE public.beaches ADD COLUMN IF NOT EXISTS region TEXT;

-- Step 4: Add check constraints for lat/lon ranges (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_lat_range'
  ) THEN
    ALTER TABLE public.beaches ADD CONSTRAINT chk_beaches_lat_range
      CHECK (lat IS NULL OR (lat >= -90 AND lat <= 90)) NOT VALID;
    ALTER TABLE public.beaches VALIDATE CONSTRAINT chk_beaches_lat_range;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_lon_range'
  ) THEN
    ALTER TABLE public.beaches ADD CONSTRAINT chk_beaches_lon_range
      CHECK (lon IS NULL OR (lon >= -180 AND lon <= 180)) NOT VALID;
    ALTER TABLE public.beaches VALIDATE CONSTRAINT chk_beaches_lon_range;
  END IF;
END $$;

-- Step 5: Recreate the geog column as a generated column using the new lat/lon columns (idempotent)
DO $$
BEGIN
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

-- Step 6: Recreate the GiST index on geog (idempotent)
CREATE INDEX IF NOT EXISTS idx_beaches_geog_gist ON public.beaches USING GIST (geog);

-- Step 7: Recreate other indexes that depend on lat/lon (idempotent)
CREATE INDEX IF NOT EXISTS idx_beaches_active_with_coords ON public.beaches (id)
  WHERE lat IS NOT NULL AND lon IS NOT NULL AND is_private = false;

CREATE INDEX IF NOT EXISTS idx_beaches_id_active ON public.beaches (id)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beaches_list_covering ON public.beaches (name, id, lat, lon, city, state)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beaches_location ON public.beaches
  USING GIST (ST_SetSRID(ST_MakePoint(lon, lat), 4326))
  WHERE lat IS NOT NULL AND lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beaches_name_with_coords ON public.beaches (name, id, lat, lon)
  WHERE lat IS NOT NULL AND lon IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beaches_public ON public.beaches (id, name, lat, lon)
  WHERE is_private = false;

-- Step 8: Update any functions that reference latitude/longitude to use lat/lon
-- Note: This will be handled by the main migration that follows

COMMIT;

-- Migration Notes:
-- 1. This migration fixes the dependency issue in 20251031021702_remote_commit.sql
-- 2. The geog column is now properly recreated as a generated column
-- 3. All indexes are recreated to use the new lat/lon columns
-- 4. Functions that use latitude/longitude will need to be updated separately
