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
--
-- Beaches NOT changed (already correct):
--   - Blacks, Scripps, La Jolla Shores → 201 (correct, Scripps is right there)
--   - Windansea, Horseshoe, PB, Crystal Pier, Tourmaline → 201 (reasonable nearest)
--   - Del Mar, Solana, Cardiff, Encinitas → 153 (Del Mar Nearshore, correct)
--   - Oceanside area → 45 (Oceanside Offshore, correct)
--   - Coronado, Imperial Beach → 155 (correct)
--   - Sunset Cliffs – Garbage → 191 (already overridden in prior migration)
--   - Torrey Pines → 153 (Del Mar Nearshore, reasonable)

BEGIN;

-- ============================================================
-- Group 1: Ocean Beach / Mission Beach → CDIP 220 (Mission Bay West)
-- ============================================================

-- Mission Beach (north end)
UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'mission-beach' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

-- Mission Beach (Central)
UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'mission-beach-central' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

-- Avalanche (south Mission Beach)
UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'avalanche' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

-- Ocean Beach
UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'ocean-beach' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

-- Ocean Beach Pier
UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'ocean-beach-pier' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

-- Big Jetty (south OB)
UPDATE public.beaches SET cdip_station = '220'
WHERE slug = 'big-jetty' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '220');

-- ============================================================
-- Group 2: Sunset Cliffs area → CDIP 191 (Point Loma South)
-- ============================================================

-- Osprey Point (between OB and Sunset Cliffs)
UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'osprey-point' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

-- Sunset Cliffs – Luscombs
UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'sunset-cliffs-luscombs-san-diego-ca' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

-- Sunset Cliffs North (Garbage) — distinct from the entry already overridden
UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'sunset-cliffs-garbage' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

-- New Break (Nubes) — south end of Sunset Cliffs
UPDATE public.beaches SET cdip_station = '191'
WHERE slug = 'new-break-nubes' AND city = 'San Diego'
  AND (cdip_station IS DISTINCT FROM '191');

COMMIT;
