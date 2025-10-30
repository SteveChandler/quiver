-- Migration: Create Location Ranking Functions
-- Purpose: Add database functions for querying beaches by location with composite scoring
-- Part of: AllTrails-style location pages feature

-- =============================================================================
-- Function: get_beaches_by_location_with_scores
-- Purpose: Retrieve beaches for a location with composite ranking scores
-- =============================================================================

CREATE OR REPLACE FUNCTION get_beaches_by_location_with_scores(
  p_city TEXT,
  p_state TEXT,
  p_country TEXT DEFAULT 'USA'
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  average_rating NUMERIC,
  review_count INTEGER,
  skill_level TEXT,
  break_type TEXT,
  description TEXT,
  crowd_level TEXT,
  best_conditions_prose TEXT,
  composite_score NUMERIC,
  recent_intel_count INTEGER,
  avg_confirmations NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.slug,
    b.city,
    b.state,
    b.country,
    b.latitude as lat,
    b.longitude as lon,
    COALESCE(review_stats.average_rating, 0)::NUMERIC as average_rating,
    COALESCE(review_stats.review_count, 0)::INTEGER as review_count,
    b.skill_level,
    b.break_type,
    b.description,
    b.crowd_level,
    b.best_conditions_prose,
    -- Composite score calculation (0-1 scale)
    -- Formula: rating(40%) + reviewVolume(30%) + recentIntel(20%) + intelQuality(10%)
    (
      -- Rating component (0-5 normalized to 0-1) * 40%
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +

      -- Review volume component (logarithmic, max at 1000+ reviews) * 30%
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +

      -- Recent intel count component (0-6+ normalized to 0-1) * 20%
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +

      -- Intel quality component (avg confirmations 0-6+ normalized to 0-1) * 10%
      (LEAST(COALESCE(intel_recent.avg_confirms, 0)::NUMERIC / 6.0, 1.0)) * 0.1
    )::NUMERIC(10, 4) as composite_score,

    COALESCE(intel_recent.count, 0)::INTEGER as recent_intel_count,
    COALESCE(intel_recent.avg_confirms, 0)::NUMERIC(10, 2) as avg_confirmations

  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER as count,
      AVG(confirmations_count)::NUMERIC as avg_confirms
    FROM intel_posts ip
    WHERE ip.beach_id = b.id
      AND ip.created_at > NOW() - INTERVAL '7 days'
      AND ip.is_active = true
  ) intel_recent ON true
  WHERE b.city = p_city
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION get_beaches_by_location_with_scores IS
'Retrieves beaches for a specific location (city, state, country) with computed composite scores.
Composite score combines: rating (40%), review volume (30%), recent intel activity (20%), intel quality (10%).
Results are ordered by composite score descending.';

-- =============================================================================
-- Function: get_all_beach_locations
-- Purpose: Get all unique city/state/country combinations for static generation
-- =============================================================================

CREATE OR REPLACE FUNCTION get_all_beach_locations()
RETURNS TABLE (
  country TEXT,
  state TEXT,
  city TEXT,
  beach_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.country,
    b.state,
    b.city,
    COUNT(*) as beach_count
  FROM beaches b
  WHERE b.is_private = false
    AND b.city IS NOT NULL
    AND b.state IS NOT NULL
    AND b.country IS NOT NULL
  GROUP BY b.country, b.state, b.city
  HAVING COUNT(*) >= 3  -- Only include locations with 3+ beaches
  ORDER BY beach_count DESC, b.country, b.state, b.city;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION get_all_beach_locations IS
'Returns all unique location combinations (city, state, country) with at least 3 beaches.
Used for Next.js static generation of location pages.';

-- =============================================================================
-- Function: get_location_stats
-- Purpose: Get aggregate statistics for a location
-- =============================================================================

CREATE OR REPLACE FUNCTION get_location_stats(
  p_city TEXT,
  p_state TEXT,
  p_country TEXT DEFAULT 'USA'
)
RETURNS TABLE (
  total_beaches BIGINT,
  average_rating NUMERIC,
  total_reviews BIGINT,
  top_beaches BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_beaches,
    AVG(review_stats.average_rating)::NUMERIC(10, 2) as average_rating,
    SUM(review_stats.review_count)::BIGINT as total_reviews,
    COUNT(CASE
      WHEN (
        (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
        (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3
      ) >= 0.8
      THEN 1
    END)::BIGINT as top_beaches
  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  WHERE b.city = p_city
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false;
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comment for documentation
COMMENT ON FUNCTION get_location_stats IS
'Returns aggregate statistics for a location including total beaches, average rating,
total reviews, and count of top-rated beaches (composite score >= 0.8).';

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Index for location queries (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_beaches_location_lookup'
  ) THEN
    CREATE INDEX idx_beaches_location_lookup ON beaches(city, state, country)
    WHERE is_private = false;
  END IF;
END $$;

-- Index for composite score calculations (intel posts recent activity)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_intel_posts_recent_activity'
  ) THEN
    CREATE INDEX idx_intel_posts_recent_activity ON intel_posts(beach_id, created_at)
    WHERE is_active = true;
  END IF;
END $$;

-- =============================================================================
-- Grant Permissions
-- =============================================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_beach_locations TO authenticated;
GRANT EXECUTE ON FUNCTION get_location_stats TO authenticated;

-- Grant execute to anon for public access (location pages are public)
GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores TO anon;
GRANT EXECUTE ON FUNCTION get_all_beach_locations TO anon;
GRANT EXECUTE ON FUNCTION get_location_stats TO anon;
