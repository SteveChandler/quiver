-- Fix location search RPC to use correct coordinate columns (lat/lon)
-- Migration created: 2025-12-12
-- Issue: get_beaches_by_location_with_scores references b.latitude/b.longitude, but schema uses b.lat/b.lon
-- Impact: /beaches/[country]/[state]/[city] pages fail during fetch, then fall back to CITY_EXISTS_NO_DATA
-- Resolution: Drop + recreate function with case-insensitive matching and lat/lon output.

BEGIN;

DROP FUNCTION IF EXISTS get_beaches_by_location_with_scores(TEXT, TEXT, TEXT);

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
    b.lat AS lat,
    b.lon AS lon,
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

COMMENT ON FUNCTION get_beaches_by_location_with_scores IS
'Retrieves beaches for a specific location (city, state, country) with computed composite scores.
Composite score combines: rating (40%), review volume (30%), recent intel activity (20%), intel quality (10%).
Uses case-insensitive matching and standardized lat/lon column naming.';

GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores TO authenticated;
GRANT EXECUTE ON FUNCTION get_beaches_by_location_with_scores TO anon;

COMMIT;

