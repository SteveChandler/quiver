-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Migration: Audit & fix San Diego CDIP buoy station assignments
--
-- Problem: Several SD-area beaches resolve to CDIP 201 (Scripps Nearshore, La Jolla)
-- via haversine nearest-station, but geographic proximity doesn't reflect oceanographic
-- reality due to Point Loma shadow and swell approach direction.
--
-- Fixes:
--   - Ocean Beach / Mission Beach area → CDIP 220 (Mission Bay West)
--     Same latitude, directly offshore in swell approach path.
--     Point Loma blocks NW refraction that Scripps sees.
--   - Sunset Cliffs area → CDIP 191 (Point Loma South)
--     South of Point Loma, different swell window than Scripps.

BEGIN;

-- Group 1: Ocean Beach / Mission Beach → CDIP 220 (Mission Bay West)

UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'mission-beach' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'mission-beach-central' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'avalanche' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'ocean-beach' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'ocean-beach-pier' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'big-jetty' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

-- Group 2: Sunset Cliffs area → CDIP 191 (Point Loma South)

UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'osprey-point' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'sunset-cliffs-luscombs-san-diego-ca' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'sunset-cliffs-garbage' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'new-break-nubes' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

COMMIT;
