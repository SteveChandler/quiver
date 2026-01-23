-- =============================================================================
-- Migration: Lower beach location threshold
-- Purpose: Remove the 3-beach minimum from get_all_beach_locations() so that
--          states like NJ, NY, TX, SC, NC (which have cities with 1-2 beaches)
--          are included in location pages and sitemaps.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_all_beach_locations()
RETURNS TABLE (
  country TEXT,
  state TEXT,
  city TEXT,
  beach_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.country,
    b.state,
    b.city,
    COUNT(*) as beach_count
  FROM beaches b
  WHERE b.is_private = false
    AND b.city IS NOT NULL
    AND b.state IS NOT NULL
    AND b.country IS NOT NULL
  GROUP BY b.country, b.state, b.city
  HAVING COUNT(*) >= 1
  ORDER BY beach_count DESC, b.country, b.state, b.city;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_all_beach_locations IS
'Returns all unique location combinations (city, state, country) with at least 1 beach.
Used for Next.js static generation of location pages and sitemaps.';
