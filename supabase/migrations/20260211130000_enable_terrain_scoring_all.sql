BEGIN;

-- Enable terrain-aware scoring for all beaches with terrain data
--
-- This migration enables terrain_enabled for all 202 beaches that have
-- swell_access_factors (terrain data) but currently have terrain_enabled=false.
--
-- Context:
-- - 59 beaches already have terrain_enabled=true (mostly San Diego)
-- - 202 beaches have terrain data but terrain_enabled=false
-- - 18 beaches have no terrain data and will remain terrain_enabled=false
--
-- This pairs with the companion migration:
-- 20260211120000_comprehensive_swell_window_fix.sql
--
-- The terrain data in swell_access_factors comes from terrain analysis that
-- calculates how topography affects swell access from different directions.
-- Enabling terrain scoring uses this data to adjust swell height calculations
-- based on blocking/shadowing effects.
--
-- Total affected: 202 beaches
-- Not affected: 59 (already enabled) + 18 (no terrain data) = 77 beaches

UPDATE beaches SET
  terrain_enabled = true
WHERE swell_access_factors IS NOT NULL
  AND terrain_enabled = false;

COMMIT;
