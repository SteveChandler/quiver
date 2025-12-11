-- Make location search case-insensitive
-- Migration created: 2025-12-04
-- Purpose: Update location search functions to use case-insensitive matching
-- This prevents issues where URL slug decoding doesn't match DB casing exactly

BEGIN;

-- =============================================================================
-- Function 1: get_beaches_by_location_with_scores
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
  WHERE LOWER(b.city) = LOWER(p_city)
    AND LOWER(b.state) = LOWER(p_state)
    AND LOWER(b.country) = LOWER(p_country)
    AND b.is_private = false
  ORDER BY composite_score DESC, review_stats.average_rating DESC, review_stats.review_count DESC;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =============================================================================
-- Function 2: get_location_stats
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
  WHERE LOWER(b.city) = LOWER(p_city)
    AND LOWER(b.state) = LOWER(p_state)
    AND LOWER(b.country) = LOWER(p_country)
    AND b.is_private = false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMIT;







