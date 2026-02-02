-- Migration: Add CDIP station override for Sunset Cliffs
--
-- Sunset Cliffs should use Point Loma South CDIP station (191) for more accurate
-- local wave data instead of relying on distant offshore buoys.

BEGIN;

-- Sunset Cliffs → Point Loma South (191)
UPDATE public.beaches
SET cdip_station = '191'
WHERE id = 'b939f928-2653-494a-831d-6394cb548190'
  AND (cdip_station IS DISTINCT FROM '191');

COMMIT;
