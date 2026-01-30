-- Beach Data Quality Audit Migration
-- Purpose: Identify beaches causing /spots/{slug} fallback URLs due to missing location data
--
-- These beaches are indexed via sitemap at /spots/{slug} but may have city/state
-- data merged in from static sources, causing the page to redirect and creating
-- "Page with redirect" errors in Google Search Console.
--
-- This is an audit-only migration - no schema changes are made.

-- ============================================================================
-- Audit Query 1: Find beaches with incomplete location data
-- These beaches have slugs but are missing city or state
-- ============================================================================
DO $$
DECLARE
  incomplete_count INTEGER;
  complete_count INTEGER;
  city_missing INTEGER;
  state_missing INTEGER;
  both_missing INTEGER;
BEGIN
  -- Count beaches with incomplete location data
  SELECT COUNT(*) INTO incomplete_count
  FROM beaches
  WHERE slug IS NOT NULL
    AND (is_private IS NULL OR is_private = false)
    AND (city IS NULL OR state IS NULL OR TRIM(city) = '' OR TRIM(state) = '');

  -- Count beaches with complete location data
  SELECT COUNT(*) INTO complete_count
  FROM beaches
  WHERE slug IS NOT NULL
    AND (is_private IS NULL OR is_private = false)
    AND city IS NOT NULL AND TRIM(city) != ''
    AND state IS NOT NULL AND TRIM(state) != '';

  -- Count specific issues
  SELECT COUNT(*) INTO city_missing
  FROM beaches
  WHERE slug IS NOT NULL
    AND (is_private IS NULL OR is_private = false)
    AND (city IS NULL OR TRIM(city) = '')
    AND state IS NOT NULL AND TRIM(state) != '';

  SELECT COUNT(*) INTO state_missing
  FROM beaches
  WHERE slug IS NOT NULL
    AND (is_private IS NULL OR is_private = false)
    AND city IS NOT NULL AND TRIM(city) != ''
    AND (state IS NULL OR TRIM(state) = '');

  SELECT COUNT(*) INTO both_missing
  FROM beaches
  WHERE slug IS NOT NULL
    AND (is_private IS NULL OR is_private = false)
    AND (city IS NULL OR TRIM(city) = '')
    AND (state IS NULL OR TRIM(state) = '');

  RAISE NOTICE '';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'BEACH DATA QUALITY AUDIT RESULTS';
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Beaches with COMPLETE location data: %', complete_count;
  RAISE NOTICE 'Beaches with INCOMPLETE location data: %', incomplete_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Breakdown of incomplete records:';
  RAISE NOTICE '  - City missing only: %', city_missing;
  RAISE NOTICE '  - State missing only: %', state_missing;
  RAISE NOTICE '  - Both city and state missing: %', both_missing;
  RAISE NOTICE '============================================';
  RAISE NOTICE '';
  RAISE NOTICE 'SEO Impact:';
  RAISE NOTICE '  - % beaches will use /spots/{slug} fallback URLs', incomplete_count;
  RAISE NOTICE '  - These may cause "Page with redirect" errors if static data provides location';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- View: Create a view for ongoing monitoring of beach data quality
-- ============================================================================
CREATE OR REPLACE VIEW beach_location_audit AS
SELECT
  id,
  name,
  slug,
  city,
  state,
  country,
  created_at,
  updated_at,
  CASE
    WHEN (city IS NULL OR TRIM(city) = '') AND (state IS NULL OR TRIM(state) = '') THEN 'BOTH_MISSING'
    WHEN city IS NULL OR TRIM(city) = '' THEN 'CITY_MISSING'
    WHEN state IS NULL OR TRIM(state) = '' THEN 'STATE_MISSING'
    ELSE 'COMPLETE'
  END as location_status
FROM beaches
WHERE slug IS NOT NULL
  AND (is_private IS NULL OR is_private = false);

COMMENT ON VIEW beach_location_audit IS
'Audit view for beach location data quality. Use to identify beaches with incomplete location data that will fall back to /spots/{slug} URLs.';

-- ============================================================================
-- Summary view for dashboards
-- ============================================================================
CREATE OR REPLACE VIEW beach_location_audit_summary AS
SELECT
  location_status,
  COUNT(*) as beach_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM beach_location_audit
GROUP BY location_status
ORDER BY
  CASE location_status
    WHEN 'BOTH_MISSING' THEN 1
    WHEN 'CITY_MISSING' THEN 2
    WHEN 'STATE_MISSING' THEN 3
    WHEN 'COMPLETE' THEN 4
  END;

COMMENT ON VIEW beach_location_audit_summary IS
'Summary statistics for beach location data quality audit.';
