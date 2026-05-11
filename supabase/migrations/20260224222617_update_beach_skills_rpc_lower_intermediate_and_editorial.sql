-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Migration: update_beach_skills_rpc_lower_intermediate_and_editorial
--
-- Changes:
-- 1. Expand has_beginner to include 'lower-intermediate' beaches
--    Rationale: lower-intermediate is the most accessible non-beginner skill level
--    and is appropriate for /beginner and /longboard intent pages.
--    Cities like Aguadilla, Isabela, Hermosa Beach, Santa Cruz have lower-intermediate
--    beaches that represent suitable beginner-friendly sessions.
--
-- 2. Add has_editorial flag: TRUE when >= 2 beaches in the city have both a description
--    AND at least one of crowd_tips/wave_tips/best_conditions_prose.
--    Used by the sitemap to guard 2-beach cities against thin content.
--
-- Must DROP first because return type is changing (adding has_editorial column).

DROP FUNCTION IF EXISTS get_cities_with_beach_skills(integer);

CREATE FUNCTION get_cities_with_beach_skills(min_beaches int DEFAULT 1)
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
    -- has_editorial: TRUE when >= 2 beaches have description + at least one editorial field
    (
      COUNT(CASE
        WHEN b.description IS NOT NULL AND b.description != ''
             AND (
               (b.crowd_tips IS NOT NULL AND b.crowd_tips != '')
               OR (b.wave_tips IS NOT NULL AND b.wave_tips != '')
               OR (b.best_conditions_prose IS NOT NULL AND b.best_conditions_prose != '')
             )
        THEN 1
      END) >= 2
    ) as has_editorial
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
'Returns cities with at least min_beaches beaches, including skill level and editorial flags.
- has_beginner: TRUE when any beach has beginner/longboard/lower-intermediate skill level.
- has_advanced: TRUE when any beach has advanced/expert skill level.
- has_editorial: TRUE when >= 2 beaches have description + at least one of crowd_tips/wave_tips/best_conditions_prose.
Used by sitemap generation and intent page static params to filter cities by content quality.';
