-- Fix beaches data quality issues identified in optimization analysis
-- Migration: 20251207100000_beaches_data_quality_fixes.sql

BEGIN;

-- ============================================================================
-- PHASE 1: Fix 4 beaches missing essential data
-- ============================================================================

-- 1. Fix Rincon - Classic California point break in Santa Barbara County
UPDATE beaches SET
  city = 'Carpinteria',
  state = 'CA',
  slug = 'rincon-carpinteria-ca'
WHERE id = 'bec2d595-ed20-4c2b-93c7-4b880406332f'
  AND name = 'Rincon'
  AND city IS NULL;

-- 2. Fix Pipeline - World-famous reef break on Oahu's North Shore
UPDATE beaches SET
  city = 'Haleiwa',
  state = 'HI',
  slug = 'pipeline-haleiwa-hi'
WHERE id = '6a0674ac-3e6d-49f3-9fd4-a4f1857c408a'
  AND name = 'Pipeline'
  AND city IS NULL;

-- 3. Fix Cardiff Reef - Reef break in Encinitas
UPDATE beaches SET
  break_type = 'reef',
  skill_level = 'intermediate'
WHERE id = '80efa1c0-37a2-4879-819b-647ae3c3d749'
  AND name = 'Cardiff Reef'
  AND break_type IS NULL;

-- 4. Fix Seabrook - Beach break in Pacific Beach, WA
UPDATE beaches SET
  break_type = 'beach',
  skill_level = 'beginner-intermediate'
WHERE id = '5079a9ab-8d43-433e-99ea-20d3667dd0a8'
  AND name = 'Seabrook (Pacific Beach area)'
  AND break_type IS NULL;

-- ============================================================================
-- PHASE 2: Fix coordinate error - New Break (Nubes) has same coords as Garbage
-- New Break (Nubes) is south of Garbage at Sunset Cliffs
-- Moving it to ~32.7145, -117.2555 (south of Luscombs at 32.7176)
-- ============================================================================

UPDATE beaches SET
  lat = 32.7145,
  lon = -117.2555
  -- geog column is auto-generated from lat/lon, no need to update
WHERE id = 'd920e1b9-9e23-4ba8-9f8e-776571435f6f'
  AND name = 'New Break (Nubes)'
  AND lat = 32.7195;  -- Only update if still at wrong coords

-- ============================================================================
-- PHASE 3: Normalize break_type values
-- Consolidate variations: "beach break" -> "beach", "reef break" -> "reef", "point break" -> "point"
-- ============================================================================

UPDATE beaches SET break_type = 'beach' WHERE break_type = 'beach break';
UPDATE beaches SET break_type = 'reef' WHERE break_type = 'reef break';
UPDATE beaches SET break_type = 'point' WHERE break_type = 'point break';

-- ============================================================================
-- PHASE 4: Normalize country value
-- ============================================================================

UPDATE beaches SET country = 'USA' WHERE country = 'United States';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================================================

-- Verify Phase 1 fixes
-- SELECT id, name, city, state, slug, break_type, skill_level FROM beaches
-- WHERE id IN ('bec2d595-ed20-4c2b-93c7-4b880406332f', '6a0674ac-3e6d-49f3-9fd4-a4f1857c408a',
--              '80efa1c0-37a2-4879-819b-647ae3c3d749', '5079a9ab-8d43-433e-99ea-20d3667dd0a8');

-- Verify Phase 2 coordinate fix
-- SELECT id, name, lat, lon FROM beaches WHERE name ILIKE '%sunset cliffs%' OR name ILIKE '%new break%';

-- Verify Phase 3 break_type normalization
-- SELECT break_type, COUNT(*) FROM beaches WHERE deleted_at IS NULL GROUP BY break_type ORDER BY COUNT(*) DESC;

-- Verify Phase 4 country normalization
-- SELECT country, COUNT(*) FROM beaches WHERE deleted_at IS NULL GROUP BY country;
