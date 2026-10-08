-- Match city slugs to city names that contain periods.
--
-- The slug "st-augustine" resolves to the pattern "st augustine", which never
-- matched the stored name "St. Augustine", so /best-time-to-surf/st-augustine
-- and every /[intent]/st-augustine page returned 404. Affected rows today:
-- St. Augustine (FL), St. Augustine Beach (FL), St. Simons Island (GA).
--
-- Only periods are stripped. Apostrophes and the ʻokina are deliberately kept:
-- "Waiʻanae" and "Waianae" (both HI) would otherwise both exact-match
-- "waianae", and findCityBySlug treats two exact matches as ambiguous.
--
-- Same signature and return type as 20260129152742, so CREATE OR REPLACE keeps
-- existing grants. search_path matches the advisor-cleanup hardening.

BEGIN;

CREATE OR REPLACE FUNCTION public.find_cities_by_pattern(
  search_pattern TEXT,
  state_filter TEXT DEFAULT NULL
)
RETURNS TABLE(city TEXT, state TEXT, beach_count BIGINT, is_exact_match BOOLEAN)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.city,
    b.state,
    COUNT(*)::BIGINT as beach_count,
    -- Exact match: normalized city equals normalized search pattern
    (unaccent(lower(b.city)) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(b.city, '-', ' '))) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(replace(b.city, '-', ' '), '.', ''))) = unaccent(lower(search_pattern))) as is_exact_match
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false)
    AND (state_filter IS NULL OR b.state = state_filter)
    AND (
      -- Match with unaccent (handles Rincon vs rincon)
      unaccent(lower(b.city)) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
      OR
      -- Match with hyphen normalization (handles Cardiff-by-the-Sea vs cardiff by the sea)
      unaccent(lower(replace(b.city, '-', ' '))) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
      OR
      -- Match with periods stripped (handles St. Augustine vs st augustine)
      unaccent(lower(replace(replace(b.city, '-', ' '), '.', ''))) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
    )
  GROUP BY b.city, b.state
  ORDER BY
    -- Exact matches first
    (unaccent(lower(b.city)) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(b.city, '-', ' '))) = unaccent(lower(search_pattern)) OR
     unaccent(lower(replace(replace(b.city, '-', ' '), '.', ''))) = unaccent(lower(search_pattern))) DESC,
    -- Then by beach count (more beaches = more popular)
    COUNT(*) DESC;
END;
$$;

COMMIT;

-- Rollback: re-run the CREATE OR REPLACE from
-- 20260129152742_fix_city_pattern_exact_match.sql with
-- SET search_path TO 'public', 'extensions', 'pg_temp'.
