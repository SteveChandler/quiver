-- Migration: update_beach_skills_rpc_editorial_and_lower_intermediate
-- Purpose: Add has_editorial column and include lower-intermediate in has_beginner
-- Fixes: Task 1A (editorial guard for 2-beach cities) and Task 1B (beginner/longboard expansion)

BEGIN;

-- Must drop first because return type changed (added has_editorial column)
DROP FUNCTION IF EXISTS get_cities_with_beach_skills(int);

CREATE OR REPLACE FUNCTION get_cities_with_beach_skills(min_beaches int DEFAULT 1)
RETURNS TABLE (
  city text,
  state text,
  country text,
  beach_count bigint,
  has_beginner boolean,
  has_advanced boolean,
  has_editorial boolean
) AS $$
  SELECT
    b.city,
    b.state,
    COALESCE(b.country, 'USA') as country,
    COUNT(*) as beach_count,
    bool_or(
      LOWER(COALESCE(b.skill_level, '')) LIKE '%beginner%'
      OR LOWER(COALESCE(b.skill_level, '')) LIKE '%longboard%'
      OR LOWER(COALESCE(b.skill_level, '')) = 'lower-intermediate'
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
    ) >= 2 as has_editorial
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false)
    AND b.city IS NOT NULL
    AND b.state IS NOT NULL
    AND b.deleted_at IS NULL
  GROUP BY b.city, b.state, b.country
  HAVING COUNT(*) >= min_beaches
  ORDER BY b.city ASC
$$ LANGUAGE sql STABLE;

-- Re-grant permissions (CREATE OR REPLACE preserves them, but explicit is safer)
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO service_role;
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_cities_with_beach_skills(int) TO anon;

COMMENT ON FUNCTION get_cities_with_beach_skills(int) IS
'Returns cities with at least min_beaches beaches, including skill level flags and editorial quality.
has_beginner includes beginner, longboard, and lower-intermediate skill levels.
has_editorial is true when >= 2 beaches have description AND at least one of crowd_tips/wave_tips/best_conditions_prose.
Used by sitemap generation and intent page static params.';

COMMIT;
