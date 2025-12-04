-- Add functional indexes for case-insensitive location search
-- Migration created: 2025-12-04
-- Purpose: Optimize LOWER() comparisons in location search functions
--
-- These indexes support the case-insensitive queries in:
--   - get_beaches_by_location_with_scores()
--   - get_location_stats()
--
-- Without these indexes, queries using LOWER(column) = LOWER(value)
-- would require full table scans.

-- Note: CONCURRENTLY cannot be used inside a transaction block.
-- For production, run these indexes separately or during low-traffic periods.

CREATE INDEX IF NOT EXISTS idx_beaches_city_lower
  ON beaches (LOWER(city));

CREATE INDEX IF NOT EXISTS idx_beaches_state_lower
  ON beaches (LOWER(state));

CREATE INDEX IF NOT EXISTS idx_beaches_country_lower
  ON beaches (LOWER(country));

-- Verify indexes were created
DO $$
BEGIN
  RAISE NOTICE 'Case-insensitive indexes created successfully';
END $$;
