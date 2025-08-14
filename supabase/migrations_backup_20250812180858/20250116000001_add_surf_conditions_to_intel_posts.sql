-- Add surf condition fields to intel_posts table
-- This allows intel posts to include detailed surf condition data like session logging

DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    ALTER TABLE public.intel_posts 
      ADD COLUMN IF NOT EXISTS wave_height DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS wind_speed DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS wind_direction TEXT,
      ADD COLUMN IF NOT EXISTS water_temp INTEGER,
      ADD COLUMN IF NOT EXISTS crowd_level INTEGER CHECK (crowd_level >= 1 AND crowd_level <= 5),
      ADD COLUMN IF NOT EXISTS wave_types TEXT[],
      ADD COLUMN IF NOT EXISTS forecast_accuracy TEXT CHECK (forecast_accuracy IN ('accurate', 'somewhat', 'inaccurate'));
  END IF;
END $$;

-- Add comments for documentation
DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    COMMENT ON COLUMN public.intel_posts.wave_height IS 'Wave height in feet (0-50)';
    COMMENT ON COLUMN public.intel_posts.wind_speed IS 'Wind speed in mph (0-150)';
    COMMENT ON COLUMN public.intel_posts.wind_direction IS 'Wind direction (N, NE, E, SE, S, SW, W, NW, OFFSHORE, ONSHORE, CROSS)';
    COMMENT ON COLUMN public.intel_posts.water_temp IS 'Water temperature in Fahrenheit (32-100)';
    COMMENT ON COLUMN public.intel_posts.crowd_level IS 'Crowd level rating from 1 (empty) to 5 (packed)';
    COMMENT ON COLUMN public.intel_posts.wave_types IS 'Array of wave characteristics (fat, mushy, peaky, powerful, closeouts, barreling, reform, clean)';
    COMMENT ON COLUMN public.intel_posts.forecast_accuracy IS 'How accurate was the forecast (accurate, somewhat, inaccurate)';
  END IF;
END $$;

-- Create index for wave_height queries (useful for finding good surf spots)
DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS intel_posts_wave_height_idx ON public.intel_posts(wave_height) WHERE wave_height IS NOT NULL;
  END IF;
END $$;

-- Create index for wind conditions (useful for kiting/windsurfing spots)
DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS intel_posts_wind_speed_idx ON public.intel_posts(wind_speed) WHERE wind_speed IS NOT NULL;
  END IF;
END $$;

-- Create index for crowd level (useful for finding less crowded spots)
DO $$
BEGIN
  IF to_regclass('public.intel_posts') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS intel_posts_crowd_level_idx ON public.intel_posts(crowd_level) WHERE crowd_level IS NOT NULL;
  END IF;
END $$;
