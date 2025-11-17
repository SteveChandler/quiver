-- Migration: Fix Horseshoe beach city field to match URL structure
-- Date: 2025-11-16
-- Purpose: Fix 500 error when clicking Horseshoe from surf highlights
-- The city "La Jolla, San Diego" slugifies to "la-jolla-san-diego" but the URL uses "la-jolla"

BEGIN;

-- Update Horseshoe beach to have city as just "La Jolla"
UPDATE public.beaches
SET city = 'La Jolla'
WHERE slug = 'horseshoe'
  AND name = 'Horseshoe'
  AND state = 'CA';

COMMIT;
