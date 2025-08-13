-- Database optimization: composite indexes and query performance improvements
-- Addresses key performance bottlenecks identified in forecast and buoy queries

BEGIN;

-- 1. Enhanced forecasts composite indexes for common query patterns
-- Optimize beach-specific forecast queries with date filtering
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_date_recent 
  ON public.enhanced_forecasts (beach_id, forecast_date DESC);

-- Optimize time-based forecast lookups
CREATE INDEX IF NOT EXISTS idx_enhanced_forecasts_beach_date_time_optimized 
  ON public.enhanced_forecasts (beach_id, forecast_date, forecast_time);

-- 2. Spot feedback performance optimization
-- Optimize user feedback queries with recency
CREATE INDEX IF NOT EXISTS idx_spot_feedback_user_recent 
  ON public.spot_feedback (user_id, created_at DESC);

-- Optimize spot-specific feedback aggregation
CREATE INDEX IF NOT EXISTS idx_spot_feedback_spot_accurate 
  ON public.spot_feedback (spot_id, accurate, created_at DESC);

-- 3. Buoys spatial and performance optimization
-- Ensure proper spatial index exists (guarded if coordinates column is present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'buoys' AND column_name = 'coordinates'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_buoys_coordinates_gist 
      ON public.buoys USING GIST (coordinates);
  ELSE
    RAISE NOTICE 'Skipping idx_buoys_coordinates_gist: public.buoys.coordinates not found';
  END IF;
END $$;

-- Optimize active buoy queries with recent data
CREATE INDEX IF NOT EXISTS idx_buoys_active_recent_data 
  ON public.buoys (active, updated_at DESC) 
  WHERE active = true;

-- Optimize buoy conditions queries (guarded if coordinates column is present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'buoys' AND column_name = 'coordinates'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_buoys_conditions_lookup 
      ON public.buoys (active, updated_at DESC) 
      WHERE active = true AND coordinates IS NOT NULL;
  ELSE
    RAISE NOTICE 'Skipping idx_buoys_conditions_lookup: public.buoys.coordinates not found';
  END IF;
END $$;

-- 4. Beaches query optimization
-- Optimize private beach ownership queries
CREATE INDEX IF NOT EXISTS idx_beaches_private_owner 
  ON public.beaches (is_private, owner_id) 
  WHERE is_private = true;

-- Optimize location-based beach searches
CREATE INDEX IF NOT EXISTS idx_beaches_location_active 
  ON public.beaches (latitude, longitude) 
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMIT;