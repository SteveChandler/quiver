-- Migration: fix_rpc_beginner_exclude_lower_intermediate
-- Purpose: Remove 'lower-intermediate' from has_beginner flag in get_cities_with_beach_skills RPC
-- Reason: The page's applyIntentFilters() only matches '%beginner%' and '%longboard%',
-- so 'lower-intermediate' in the RPC causes sitemap to include cities/states that
-- then return noindex (NH, NJ, NY, GA, RI, SC, NC only have lower-intermediate beaches).

BEGIN;

DROP FUNCTION IF EXISTS get_cities_with_beach_skills(int);

CREATE OR REPLACE FUNCTION get_cities_with_beach_skills(min_beaches int DEFAULT 1)
RETURNS TABLE (
  city text,
  state text,
  country text,
  beach_count bigint,
  has_beginner boolean,
  has_advanced boolean,
  has_editorial boolean,
  has_least_crowded boolean
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
    ) as has_advanced,
    COUNT(*) FILTER (
      WHERE COALESCE(b.description, '') <> ''
      AND (
        COALESCE(b.crowd_tips, '') <> ''
        OR COALESCE(b.wave_tips, '') <> ''
        OR COALESCE(b.best_conditions_prose, '') <> ''
      )
    ) >= 2 as has_editorial,
    bool_or(
      LOWER(COALESCE(b.crowd_level, '')) IN ('light', 'moderate')
    ) as has_least_crowded
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false)
    AND b.city IS NOT NULL
    AND b.state IS NOT NULL
    AND b.deleted_at IS NULL
  GROUP BY b.city, b.state, b.country
  HAVING COUNT(*) >= min_beaches
  ORDER BY b.city ASC
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO service_role;
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO anon;

COMMENT ON FUNCTION get_cities_with_beach_skills(int) IS
'Returns cities with at least min_beaches beaches, including skill level, editorial, and crowd flags.
has_beginner includes beginner and longboard skill levels (not lower-intermediate).
has_advanced includes advanced and expert skill levels.
has_editorial is true when >= 2 beaches have description AND at least one of crowd_tips/wave_tips/best_conditions_prose.
has_least_crowded is true when at least one beach has crowd_level of light or moderate.
Used by sitemap generation and intent page static params.';

COMMIT;
