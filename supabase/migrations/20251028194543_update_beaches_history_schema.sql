-- Update beaches_history table to match current beaches schema
-- Fixes warnings about missing city column in beaches_history
-- This ensures audit logging works correctly after column renames

BEGIN;

-- Check if beaches_history table exists and update its schema
DO $$
BEGIN
  -- Only proceed if beaches_history table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'beaches_history'
  ) THEN

    -- Case 1: If location and region columns exist, rename them
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'beaches_history'
      AND column_name = 'location'
    ) AND EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'beaches_history'
      AND column_name = 'region'
    ) THEN
      ALTER TABLE public.beaches_history RENAME COLUMN location TO city;
      ALTER TABLE public.beaches_history RENAME COLUMN region TO state;
      RAISE NOTICE 'Renamed beaches_history columns: location → city, region → state';

    -- Case 2: If location doesn't exist but city doesn't exist either, add city and state
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'beaches_history'
      AND column_name = 'city'
    ) THEN
      ALTER TABLE public.beaches_history ADD COLUMN IF NOT EXISTS city TEXT;
      ALTER TABLE public.beaches_history ADD COLUMN IF NOT EXISTS state TEXT;
      RAISE NOTICE 'Added city and state columns to beaches_history';

    ELSE
      RAISE NOTICE 'beaches_history schema already up to date';
    END IF;

    -- Handle coordinate column renames if needed
    -- Check if latitude/longitude exist and need to be handled
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'beaches_history'
      AND column_name = 'latitude'
    ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
      AND table_name = 'beaches_history'
      AND column_name = 'lat'
    ) THEN
      -- Copy data from latitude/longitude to lat/lon if they don't exist
      ALTER TABLE public.beaches_history ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;
      ALTER TABLE public.beaches_history ADD COLUMN IF NOT EXISTS lon DOUBLE PRECISION;

      UPDATE public.beaches_history
      SET lat = latitude, lon = longitude
      WHERE latitude IS NOT NULL OR longitude IS NOT NULL;

      RAISE NOTICE 'Copied coordinate data from latitude/longitude to lat/lon in beaches_history';
    END IF;

  ELSE
    RAISE NOTICE 'beaches_history table does not exist, skipping';
  END IF;
END $$;

COMMIT;
