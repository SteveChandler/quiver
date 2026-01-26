-- Migration: create_get_cities_with_skills_rpc
-- Purpose: Replace client-side aggregation in getAllCitiesWithBeachSkills with database-side aggregation
-- This significantly reduces data transfer and improves performance for sitemap generation and static params

-- Create the RPC function for city aggregation with skill levels
CREATE OR REPLACE FUNCTION get_cities_with_beach_skills(min_beaches int DEFAULT 1)
RETURNS TABLE (
  city text,
  state text,
  country text,
  beach_count bigint,
  has_beginner boolean,
  has_advanced boolean
) AS $$
  SELECT
    b.city,
    b.state,
    COALESCE(b.country, 'USA') as country,
    COUNT(*) as beach_count,
    bool_or(
      LOWER(COALESCE(b.skill_level, '')) LIKE '%beginner%'
      OR LOWER(COALESCE(b.skill_level, '')) LIKE '%longboard%'
    ) as has_beginner,
    bool_or(
      LOWER(COALESCE(b.skill_level, '')) LIKE '%advanced%'
      OR LOWER(COALESCE(b.skill_level, '')) LIKE '%expert%'
    ) as has_advanced
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false)
    AND b.city IS NOT NULL
    AND b.state IS NOT NULL
    AND b.deleted_at IS NULL
  GROUP BY b.city, b.state, b.country
  HAVING COUNT(*) >= min_beaches
  ORDER BY b.city ASC
$$ LANGUAGE sql STABLE;

-- Grant execute permission to the service role and authenticated users
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO service_role;
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO anon;

-- Add comment for documentation
COMMENT ON FUNCTION get_cities_with_beach_skills(int) IS
'Returns cities with at least min_beaches beaches, including skill level flags.
Used by sitemap generation and intent page static params to filter cities by skill levels.
Replaces client-side aggregation for better performance.';
