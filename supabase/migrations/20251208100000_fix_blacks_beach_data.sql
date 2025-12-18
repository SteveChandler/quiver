-- Fix Blacks Beach missing city/state/slug data
-- This beach was seeded early without proper location fields
-- Migration: 20251208100000_fix_blacks_beach_data.sql

BEGIN;

-- Update Blacks Beach with proper location data
-- It's a world-famous beach break at the base of Torrey Pines in La Jolla
-- Note: Keep slug as 'blacks' for backwards compatibility with existing links
UPDATE public.beaches SET
  city = 'La Jolla',
  state = 'CA',
  slug = COALESCE(slug, 'blacks'),  -- Only set if NULL, preserve existing
  -- Also ensure break_type is normalized (previous migration set 'beach break')
  break_type = 'beach'
WHERE id = '01330afc-00d3-461b-88f3-b173774766f4'
  AND name = 'Blacks';

COMMIT;

-- ============================================================================
-- VERIFICATION (run after migration)
-- ============================================================================
-- SELECT id, name, city, state, slug, break_type 
-- FROM beaches 
-- WHERE id = '01330afc-00d3-461b-88f3-b173774766f4';
--
-- Expected result:
-- id: 01330afc-00d3-461b-88f3-b173774766f4
-- name: Blacks
-- city: La Jolla  
-- state: CA
-- slug: blacks
-- break_type: beach
--
-- After this migration, the beach should be accessible at:
-- - /ca/la-jolla/blacks (hierarchical URL - preferred)
-- - /beach/blacks (legacy URL - will redirect to hierarchical)






