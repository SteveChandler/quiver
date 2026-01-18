-- Enable unaccent extension for accent-insensitive text matching
-- Used by city slug lookups to match "rincon" → "Rincón"

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Verify extension is enabled
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'unaccent') THEN
    RAISE EXCEPTION 'unaccent extension failed to install';
  END IF;
END $$;

-- Function to find cities matching a slug pattern with accent/hyphen normalization
-- Used by findCityBySlug to handle:
--   - Accented names: "rincon" matches "Rincón"
--   - Hyphenated names: "cardiff by the sea" matches "Cardiff-by-the-Sea"
-- Returns city, state, and beach_count for filtering cities with enough beaches
CREATE OR REPLACE FUNCTION find_cities_by_pattern(
  search_pattern TEXT,
  state_filter TEXT DEFAULT NULL
)
RETURNS TABLE(city TEXT, state TEXT, beach_count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT b.city, b.state, COUNT(*)::BIGINT as beach_count
  FROM beaches b
  WHERE (b.is_private IS NULL OR b.is_private = false)
    AND (state_filter IS NULL OR b.state = state_filter)
    AND (
      -- Match with unaccent (handles Rincón vs rincon)
      unaccent(lower(b.city)) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
      OR
      -- Match with hyphen normalization (handles Cardiff-by-the-Sea vs cardiff by the sea)
      unaccent(lower(replace(b.city, '-', ' '))) ILIKE '%' || unaccent(lower(search_pattern)) || '%'
    )
  GROUP BY b.city, b.state;
END;
$$ LANGUAGE plpgsql STABLE;
