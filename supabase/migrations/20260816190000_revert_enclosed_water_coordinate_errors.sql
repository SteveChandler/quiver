-- UNAPPLIED FORWARD MIGRATION (2026-08-16)
--
-- Revert 19 coordinate corrections that moved beaches into the wrong water.
--
-- Migration 20260816120000 corrected 99 inland beaches and was verified with an
-- endpoint test: still water 1km and 3km further along the correction bearing.
-- That test cannot see enclosed water. A tidal lagoon, bay, harbour or river
-- mouth passes it, because the sample points land in the connected sea beyond.
--
-- All 95 applied corrections were subsequently rendered as before/after maps and
-- reviewed by eye. 76 are correct and stay. These 19 are not: they moved the
-- beach into a lagoon, bay, harbour, river or pond rather than onto the ocean
-- shoreline. Bolinas went to the lagoon side of town, Doheny into Dana Point
-- harbour, both Westport records into Grays Harbor, Brinley Avenue into Sylvan
-- Lake, Publics inland by Honolulu Zoo.
--
-- Restores each to the exact pre-correction value recorded in
-- beach_coordinate_corrections. Those coordinates are also wrong — most are
-- inland — but they are the values the data had before this work, and a known
-- prior state is preferable to an unverified edit of mine. They are the
-- remaining backlog for someone who knows these spots.
--
-- The audit rows are marked rather than deleted, so the history stays intact.

BEGIN;

CREATE TEMP TABLE _revert_slugs (slug text PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _revert_slugs (slug) VALUES
  ('1st-street-jetty-ocean-city-nj'),
  ('3rd-avenue-jetty-belmar-nj'),
  ('7th-street-beach-ocean-city-nj'),
  ('bandon'),
  ('bolinas-bolinas-ca'),
  ('brinley-avenue-bradley-beach-nj'),
  ('cannon-beach-ecolaindian'),
  ('doheny'),
  ('higgins-beach-scarborough-me'),
  ('humbug-mountain-port-orford'),
  ('malibu-second-point-malibu-ca'),
  ('newport-56th-st'),
  ('oceano-grover-beach-ca'),
  ('ocean-shores'),
  ('ogunquit-beach-ogunquit-me'),
  ('point-arena-manchester-beach-ca'),
  ('publics'),
  ('westport-beach'),
  ('westport-marinagroinsjetty');

UPDATE public.beaches b
SET lat = c.old_lat,
    lon = c.old_lon
FROM public.beach_coordinate_corrections c
JOIN _revert_slugs r ON r.slug = c.slug
WHERE c.beach_id = b.id
  AND c.reason LIKE 'inland-coordinate-audit-2026-08-16%'
  AND (b.lat IS DISTINCT FROM c.old_lat OR b.lon IS DISTINCT FROM c.old_lon);

UPDATE public.beach_coordinate_corrections c
SET reason = c.reason || ' | REVERTED 2026-08-16: landed in enclosed water (lagoon/bay/harbour/river/pond) on visual review'
FROM _revert_slugs r
WHERE r.slug = c.slug
  AND c.reason LIKE 'inland-coordinate-audit-2026-08-16%'
  AND c.reason NOT LIKE '%REVERTED%';

COMMIT;
