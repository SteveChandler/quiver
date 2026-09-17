-- DRAFT awaiting Steven's approval. Generated from the 2026-09-17 offshore-bearing review.
-- No production database action has been taken.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- No HIGH-confidence CHANGE rows were produced because the Overpass coastline
-- endpoint was unavailable during the run. Do not add MEDIUM rows here without review.

COMMIT;

/* Matching rollback for any subsequently approved HIGH rows:
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
-- Replace each approved update with its original current_offshore value, guarded by
-- the proposed value, for example:
-- UPDATE public.beaches SET wind_offshore_deg = <current> WHERE slug = '<slug>' AND wind_offshore_deg = <proposed>;
COMMIT;
*/

/* MEDIUM rows for review only; intentionally not executable.
-- See docs/reports/2026-09-17-offshore-bearing-review.md for evidence and notes.
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = '204s' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 75 WHERE slug = 'andrew-molera-river-mouth-big-sur-ca' AND wind_offshore_deg = 70;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'beacons' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'big-rock-la-jolla-ca' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'birdrock' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'blacks' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'cardiff-reef' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'county-line-malibu-ca' AND wind_offshore_deg = 0;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'c-street-ventura-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 85 WHERE slug = 'del-mar' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'del-mar-rivermouth' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'd-street' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'el-segundo-beach-jetty-el-segundo-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'emma-wood-ventura-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'forster-st-oceanside' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'georges' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'grandview' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'horseshoe' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'la-jolla-shores' AND wind_offshore_deg = 135;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'manhattan-beach-pier-manhattan-beach-ca' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'mission-beach' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'mission-beach-central' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'mondos-beach-ventura-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'moonlight-state-beach' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'ocean-beach-pier' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 100 WHERE slug = 'ocean-beach-sloat-san-francisco-ca' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'oceanside-harbor' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'pacific-beach' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'pb-point' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'pipes' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'ponto' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'san-elijo-state-beach' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'scripps' AND wind_offshore_deg = 135;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'seaside-reef' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 40 WHERE slug = 'shipwrecks-coronado-ca' AND wind_offshore_deg = 0;
-- UPDATE public.beaches SET wind_offshore_deg = 10 WHERE slug = 'silver-strand-state-beach' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'solana-beach' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'solimar-reef-ventura-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'sunset-cliffs-garbage' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'swamis' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'tamarack' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'terramar-point' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'topanga-malibu-ca' AND wind_offshore_deg = 0;
-- UPDATE public.beaches SET wind_offshore_deg = 80 WHERE slug = 'torrey-pines-state-beach' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 70 WHERE slug = 'tourmaline-surf-park' AND wind_offshore_deg = 90;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'venice-breakwater-los-angeles-ca' AND wind_offshore_deg = 45;
-- UPDATE public.beaches SET wind_offshore_deg = 90 WHERE slug = 'windansea' AND wind_offshore_deg = 90;
*/
