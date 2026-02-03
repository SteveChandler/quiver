-- Fix city pattern matching to prefer exact matches over substring matches
-- Resolves SEO issue where "koloa" incorrectly matches "waikoloa" due to ILIKE substring matching
--
-- Before: find_cities_by_pattern('koloa', 'HI') returns both Koloa and Waikoloa
-- After: Returns both but with is_exact_match=true for Koloa, ordered so exact matches come first

-- Must DROP first because return type is changing (adding is_exact_match column)
DROP FUNCTION IF EXISTS find_cities_by_pattern(TEXT, TEXT);

CREATE OR REPLACE FUNCTION find_cities_by_pattern(
  search_pattern TEXT,
  state_filter TEXT DEFAULT NULL
)
RETURNS TABLE(city TEXT, state TEXT, beach_count BIGINT, is_exact_match BOOLEAN) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.city,
    b.state,
    COUNT(*)::BIGINT as beach_count,
    -- Exact match: normalized city equals normalized search pattern
    (unaccent(lower(b.city)) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(b.city, '-', ' '))) = unaccent(lower(search_pattern))) as is_exact_match
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false)
    AND (state_filter IS NULL OR b.state = state_filter)
    AND (
      -- Match with unaccent (handles Rincon vs rincon)
      unaccent(lower(b.city)) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
      OR
      -- Match with hyphen normalization (handles Cardiff-by-the-Sea vs cardiff by the sea)
      unaccent(lower(replace(b.city, '-', ' '))) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
    )
  GROUP BY b.city, b.state
  ORDER BY
    -- Exact matches first
    (unaccent(lower(b.city)) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(b.city, '-', ' '))) = unaccent(lower(search_pattern))) DESC,
    -- Then by beach count (more beaches = more popular)
    COUNT(*) DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Rollback:
-- CREATE OR REPLACE FUNCTION find_cities_by_pattern(
--   search_pattern TEXT,
--   state_filter TEXT DEFAULT NULL
-- )
-- RETURNS TABLE(city TEXT, state TEXT, beach_count BIGINT) AS $$
-- BEGIN
--   RETURN QUERY
--   SELECT b.city, b.state, COUNT(*)::BIGINT as beach_count
--   FROM beaches b
--   WHERE (b.is_private IS NULL OR b.is_private = false)
--     AND (state_filter IS NULL OR b.state = state_filter)
--     AND (
--       unaccent(lower(b.city)) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
--       OR
--       unaccent(lower(replace(b.city, '-', ' '))) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
--     )
--   GROUP BY b.city, b.state;
-- END;
-- $$ LANGUAGE plpgsql STABLE;
