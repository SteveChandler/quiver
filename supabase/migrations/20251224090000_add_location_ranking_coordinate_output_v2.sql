-- Add v2 location ranking RPCs that standardize coordinate output field names.
--
-- Motivation:
-- - Our codebase historically mixed `lat/lon`, `lat/lng`, and `latitude/longitude`.
-- - Coordinate conventions documentation prefers full names for RPC outputs.
-- - These v2 functions are non-breaking: existing functions remain unchanged.
--
-- NOTE:
-- - Beaches schema has evolved over time; some environments may have `lat/lon`,
--   others may have `latitude/longitude`. We use COALESCE to support both.
--
BEGIN;

-- =============================================================================
-- Function: get_beaches_by_location_with_scores_v2
-- Purpose: Same as get_beaches_by_location_with_scores, but returns
--          `latitude` / `longitude` fields instead of `lat` / `lon`.
-- =============================================================================

DROP FUNCTION IF EXISTS get_beaches_by_location_with_scores_v2(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_beaches_by_location_with_scores_v2(
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
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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
    COALESCE(b.lat, b.latitude) AS latitude,
    COALESCE(b.lon, b.longitude) AS longitude,
    COALESCE(review_stats.average_rating, 0)::NUMERIC AS average_rating,
    COALESCE(review_stats.review_count, 0)::INTEGER AS review_count,
    b.skill_level,
    b.break_type,
    b.description,
    b.crowd_level,
    b.best_conditions_prose,
    (
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +
      (LEAST(COALESCE(intel_recent.avg_confirms, 0)::NUMERIC / 6.0, 1.0)) * 0.1
    )::NUMERIC(10, 4) AS composite_score,
    COALESCE(intel_recent.count, 0)::INTEGER AS recent_intel_count,
    COALESCE(intel_recent.avg_confirms, 0)::NUMERIC(10, 2) AS avg_confirmations
  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) AS average_rating,
      COUNT(*)::INTEGER AS review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS count,
      AVG(confirmations_count)::NUMERIC AS avg_confirms
    FROM intel_posts ip
    WHERE ip.beach_id = b.id
      AND ip.created_at > NOW() - INTERVAL '7 days'
      AND ip.is_active = true
  ) intel_recent ON true
  WHERE LOWER(b.city) = LOWER(p_city)
    AND LOWER(b.state) = LOWER(p_state)
    AND LOWER(b.country) = LOWER(p_country)
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_beaches_by_location_with_scores_v2 IS
'v2 of get_beaches_by_location_with_scores. Returns `latitude`/`longitude` fields instead of `lat`/`lon`.
Composite score combines: rating (40%), review volume (30%), recent intel activity (20%), intel quality (10%).
Uses case-insensitive matching and supports legacy beach schemas via COALESCE(lat, latitude) / COALESCE(lon, longitude).';

GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores_v2 TO anon;

-- =============================================================================
-- Function: get_beaches_by_metro_with_scores_v2
-- Purpose: Same as get_beaches_by_metro_with_scores, but returns
--          `latitude` / `longitude` fields instead of `lat` / `lon`.
-- =============================================================================

DROP FUNCTION IF EXISTS get_beaches_by_metro_with_scores_v2(TEXT[], TEXT, TEXT);

CREATE OR REPLACE FUNCTION get_beaches_by_metro_with_scores_v2(
  p_cities TEXT[],
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
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
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
    COALESCE(b.lat, b.latitude) AS latitude,
    COALESCE(b.lon, b.longitude) AS longitude,
    COALESCE(review_stats.average_rating, 0)::NUMERIC AS average_rating,
    COALESCE(review_stats.review_count, 0)::INTEGER AS review_count,
    b.skill_level,
    b.break_type,
    b.description,
    b.crowd_level,
    b.best_conditions_prose,
    (
      (COALESCE(review_stats.average_rating, 0) / 5.0) * 0.4 +
      (LEAST(LOG(10, COALESCE(review_stats.review_count, 0) + 1) / LOG(10, 1000), 1.0)) * 0.3 +
      (LEAST(COALESCE(intel_recent.count, 0)::NUMERIC / 6.0, 1.0)) * 0.2 +
      (LEAST(COALESCE(intel_recent.avg_confirms, 0)::NUMERIC / 6.0, 1.0)) * 0.1
    )::NUMERIC(10, 4) AS composite_score,
    COALESCE(intel_recent.count, 0)::INTEGER AS recent_intel_count,
    COALESCE(intel_recent.avg_confirms, 0)::NUMERIC(10, 2) AS avg_confirmations
  FROM beaches b
  LEFT JOIN LATERAL (
    SELECT
      AVG(overall_rating)::NUMERIC(10, 2) AS average_rating,
      COUNT(*)::INTEGER AS review_count
    FROM beach_reviews br
    WHERE br.beach_id = b.id
  ) review_stats ON true
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS count,
      AVG(confirmations_count)::NUMERIC AS avg_confirms
    FROM intel_posts ip
    WHERE ip.beach_id = b.id
      AND ip.created_at > NOW() - INTERVAL '7 days'
      AND ip.is_active = true
  ) intel_recent ON true
  WHERE b.city = ANY(p_cities)
    AND LOWER(b.state) = LOWER(p_state)
    AND LOWER(b.country) = LOWER(p_country)
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_beaches_by_metro_with_scores_v2 IS
'v2 of get_beaches_by_metro_with_scores. Returns `latitude`/`longitude` fields instead of `lat`/`lon`.
Beaches are ranked globally across all cities. Uses case-insensitive matching for state/country and supports
legacy beach schemas via COALESCE(lat, latitude) / COALESCE(lon, longitude).';

GRANT EXECUTE ON FUNCTION get_beaches_by_metro_with_scores_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION get_beaches_by_metro_with_scores_v2 TO anon;

COMMIT;


