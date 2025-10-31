-- Add data validation constraints and performance indexes to beaches table
-- Ensures data quality and improves query performance

BEGIN;

-- ============================================================================
-- PART 1: DATA VALIDATION CONSTRAINTS
-- ============================================================================

-- Geographic coordinate constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_lat_range') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_lat_range
        CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_lon_range') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_lon_range
        CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180));
  END IF;
END $$;

-- Degree constraints (0-360 for compass bearings)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_aspect_range') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_aspect_range
        CHECK (aspect_deg IS NULL OR (aspect_deg >= 0 AND aspect_deg < 360));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_wind_offshore_range') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_wind_offshore_range
        CHECK (wind_offshore_deg IS NULL OR (wind_offshore_deg >= 0 AND wind_offshore_deg < 360));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_swell_window_range') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_swell_window_range
        CHECK (
          (swell_window_min_deg IS NULL OR (swell_window_min_deg >= 0 AND swell_window_min_deg < 360)) AND
          (swell_window_max_deg IS NULL OR (swell_window_max_deg >= 0 AND swell_window_max_deg < 360)) AND
          (swell_window_center_deg IS NULL OR (swell_window_center_deg >= 0 AND swell_window_center_deg < 360))
        );
  END IF;
END $$;

-- Wind speed constraints (non-negative)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_wind_speeds_positive') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_wind_speeds_positive
        CHECK (
          (wind_cross_shore_ok_kt IS NULL OR wind_cross_shore_ok_kt >= 0) AND
          (wind_onshore_bad_kt IS NULL OR wind_onshore_bad_kt >= 0) AND
          (wind_offshore_tol_deg IS NULL OR wind_offshore_tol_deg >= 0)
        );
  END IF;
END $$;

-- Tide constraints (reasonable ranges)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_tide_range') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_tide_range
        CHECK (
          (preferred_tide_ft_min IS NULL OR preferred_tide_ft_min >= -5) AND
          (preferred_tide_ft_max IS NULL OR preferred_tide_ft_max <= 15) AND
          (preferred_tide_ft_min IS NULL OR preferred_tide_ft_max IS NULL OR preferred_tide_ft_min <= preferred_tide_ft_max)
        );
  END IF;
END $$;

-- Swell window halfwidth constraint (0-180 degrees)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_beaches_swell_halfwidth_range') THEN
    ALTER TABLE public.beaches
      ADD CONSTRAINT chk_beaches_swell_halfwidth_range
        CHECK (swell_window_halfwidth_deg IS NULL OR (swell_window_halfwidth_deg >= 0 AND swell_window_halfwidth_deg <= 180));
  END IF;
END $$;

-- ============================================================================
-- PART 2: PERFORMANCE INDEXES
-- ============================================================================

-- Exact slug lookup (complements existing trigram index)
CREATE INDEX IF NOT EXISTS idx_beaches_slug_exact
  ON public.beaches(slug)
  WHERE slug IS NOT NULL;

-- Location hierarchy for geographic filtering
CREATE INDEX IF NOT EXISTS idx_beaches_location_hierarchy
  ON public.beaches(country, state, city);

-- Public beaches partial index (excludes private beaches from general queries)
CREATE INDEX IF NOT EXISTS idx_beaches_public
  ON public.beaches(id, name, latitude, longitude)
  WHERE is_private = false;

-- Active beaches with coordinates (for map/nearby queries)
CREATE INDEX IF NOT EXISTS idx_beaches_active_with_coords
  ON public.beaches(id)
  WHERE latitude IS NOT NULL
    AND longitude IS NOT NULL
    AND is_private = false;

-- Country-specific queries
CREATE INDEX IF NOT EXISTS idx_beaches_country
  ON public.beaches(country)
  WHERE country IS NOT NULL;

-- State/region queries
CREATE INDEX IF NOT EXISTS idx_beaches_state
  ON public.beaches(state)
  WHERE state IS NOT NULL;

-- Break type filtering
CREATE INDEX IF NOT EXISTS idx_beaches_break_type
  ON public.beaches(break_type)
  WHERE break_type IS NOT NULL;

-- Skill level filtering
CREATE INDEX IF NOT EXISTS idx_beaches_skill_level
  ON public.beaches(skill_level)
  WHERE skill_level IS NOT NULL;

-- ============================================================================
-- PART 3: COVERING INDEXES FOR COMMON QUERIES
-- ============================================================================

-- Beach list query optimization (name, location, coordinates)
-- Note: This may already exist from previous migrations, using IF NOT EXISTS
CREATE INDEX IF NOT EXISTS idx_beaches_list_covering
  ON public.beaches(name, id, latitude, longitude, city, state)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMIT;
