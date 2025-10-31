-- Migration: Create Metro Area Functions
-- Created: 2025-10-30
-- Purpose: Add database functions for querying beaches across multiple cities in a metro area
--
-- This migration enables aggregate location pages (e.g., "San Diego") that combine
-- beaches from multiple neighborhoods (La Jolla, Pacific Beach, etc.)
--
-- New Functions:
-- 1. get_beaches_by_metro_with_scores(p_cities, p_state, p_country)
--    - Returns beaches from multiple cities with composite scores
--    - Uses same ranking algorithm as single-city pages
-- 2. get_metro_stats(p_cities, p_state, p_country)
--    - Returns aggregate statistics across metro area

-- =============================================================================
-- Function: get_beaches_by_metro_with_scores
-- Purpose: Retrieve beaches for multiple cities in a metro area with composite scores
-- =============================================================================

CREATE OR REPLACE FUNCTION get_beaches_by_metro_with_scores(
  p_cities TEXT[],  -- Array of city names in the metro (e.g., ['La Jolla', 'Pacific Beach', 'San Diego'])
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
    -- Composite score calculation (same formula as single-city function)
    -- Weights: Rating 40%, Review Count 30%, Recent Intel 20%, Intel Confirmations 10%
    (
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +
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
  WHERE b.city = ANY(p_cities)  -- Match any city in the array
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_beaches_by_metro_with_scores IS
'Retrieves beaches across multiple cities in a metro area with composite scores.
Useful for aggregate views like "San Diego Area" which includes La Jolla, Pacific Beach, etc.
Beaches are ranked globally across all neighborhoods, not per-neighborhood.

Example usage:
  SELECT * FROM get_beaches_by_metro_with_scores(
    ARRAY[''La Jolla'', ''Pacific Beach'', ''San Diego''],
    ''CA'',
    ''USA''
  );
';

-- =============================================================================
-- Function: get_metro_stats
-- Purpose: Get aggregate statistics for a metro area (multiple cities)
-- =============================================================================

CREATE OR REPLACE FUNCTION get_metro_stats(
  p_cities TEXT[],
  p_state TEXT,
  p_country TEXT DEFAULT 'USA'
)
RETURNS TABLE (
  total_beaches BIGINT,
  average_rating NUMERIC,
  total_reviews BIGINT,
  top_beaches BIGINT,
  cities_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_beaches,
    AVG(review_stats.average_rating)::NUMERIC(10, 2) as average_rating,
    SUM(review_stats.review_count)::BIGINT as total_reviews,
    -- Count beaches with composite score >= 0.8 (tier 1-2)
    COUNT(CASE
      WHEN (
        (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
        (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3
      ) >= 0.8
      THEN 1
    END)::BIGINT as top_beaches,
    CARDINALITY(p_cities)::INTEGER as cities_count
  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) as average_rating,
      COUNT(*)::INTEGER as review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  WHERE b.city = ANY(p_cities)
    AND b.state = p_state
    AND b.country = p_country
    AND b.is_private = false;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_metro_stats IS
'Returns aggregate statistics for a metro area spanning multiple cities.
Provides total beaches, average rating, total reviews, and count of top-rated beaches.

Example usage:
  SELECT * FROM get_metro_stats(
    ARRAY[''La Jolla'', ''Pacific Beach'', ''San Diego''],
    ''CA'',
    ''USA''
  );
';

-- =============================================================================
-- Grant Permissions
-- =============================================================================

GRANT EXECUTE ON FUNCTION get_beaches_by_metro_with_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_metro_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_beaches_by_metro_with_scores TO anon;
GRANT EXECUTE ON FUNCTION get_metro_stats TO anon;

-- =============================================================================
-- Testing Queries (commented out - uncomment to test locally)
-- =============================================================================

/*
-- Test get_beaches_by_metro_with_scores
SELECT
  name,
  city,
  average_rating,
  review_count,
  composite_score,
  recent_intel_count
FROM get_beaches_by_metro_with_scores(
  ARRAY['La Jolla', 'Pacific Beach', 'San Diego'],
  'CA',
  'USA'
)
LIMIT 5;

-- Test get_metro_stats
SELECT * FROM get_metro_stats(
  ARRAY['La Jolla', 'Pacific Beach', 'San Diego'],
  'CA',
  'USA'
);

-- Verify city names match exactly
SELECT DISTINCT city, state, country
FROM beaches
WHERE state = 'CA'
  AND country = 'USA'
  AND city IN ('La Jolla', 'Pacific Beach', 'San Diego')
ORDER BY city;
*/
