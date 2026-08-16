-- UNAPPLIED FORWARD MIGRATION (2026-08-16)
--
-- Move beach coordinates that sit inland onto the waterline.
--
-- A Mapbox water-layer audit of all 346 beaches found 99 whose stored point is
-- more than 120m from water; 247 were already fine. This migration corrects 96
-- of them by two passes, each stepping seaward until the point is within 40m of
-- water — that stops at the waterline rather than out in open ocean:
--   54 by walking the beach's own aspect_deg bearing
--   42 by walking the bearing to the nearest water polygon vertex, for beaches
--      with no aspect_deg recorded
--
-- Three are deliberately NOT corrected here and need a human eye:
--   westport-marinagroinsjetty  the bearing moved it 2.5km, likely into the
--                               marina basin rather than the surf
--   linda-mar-pacifica-ca       no water polygon within 4km of the stored point
--   204s                        same
--
-- beaches.lat/lon is not only the map pin: it feeds NOAA/CDIP station
-- selection and nearby-spot distance. Every correction here moves a point
-- toward the surf it describes, which is the direction those consumers want.
--
-- Reversible: prior values are captured in beach_coordinate_corrections before
-- the UPDATE. See the rollback block at the bottom of this file.

BEGIN;

CREATE TABLE IF NOT EXISTS public.beach_coordinate_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  slug text NOT NULL,
  old_lat double precision NOT NULL,
  old_lon double precision NOT NULL,
  new_lat double precision NOT NULL,
  new_lon double precision NOT NULL,
  reason text NOT NULL,
  corrected_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beach_coordinate_corrections ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.beach_coordinate_corrections IS
  'Audit + rollback source for beach lat/lon corrections. One row per changed beach.';

CREATE TEMP TABLE _coord_fix (slug text PRIMARY KEY, new_lat double precision, new_lon double precision) ON COMMIT DROP;

INSERT INTO _coord_fix (slug, new_lat, new_lon) VALUES
  ('cardiff-reef', 33.019881, -117.285014),
  ('belmar-belmar-nj', 40.175979, -74.009637),
  ('del-mar', 32.959464, -117.2684),
  ('kill-devil-hills-kill-devil-hills-nc', 36.022631, -75.659848),
  ('long-branch-long-branch-nj', 40.313059, -73.975482),
  ('manhattan-beach-pier-manhattan-beach-ca', 33.8841, -118.413064),
  ('middles-isabela', 18.515531, -67.090578),
  ('mission-beach', 32.781986, -117.254657),
  ('moonlight-state-beach', 33.0469, -117.297987),
  ('54th-street-newport-beach-ca', 33.613186, -117.934125),
  ('pipes', 33.0257, -117.288029),
  ('bay-street-santa-monica-ca', 34.011715, -118.500836),
  ('bandon', 43.11846, -124.432173),
  ('cape-hatteras-lighthouse-buxton-nc', 35.226608, -75.523723),
  ('off-the-wall', 21.66635, -158.05045),
  ('publics', 21.266478, -157.814),
  ('oceano-grover-beach-ca', 35.105, -120.624392),
  ('velzyland', 21.703356, -157.998747),
  ('forster-st-oceanside', 33.186, -117.37704),
  ('d-street', 33.046, -117.298358),
  ('marina-state-beach-marina-ca', 36.690764, -121.812031),
  ('marine-street-beach', 32.840443, -117.282078),
  ('brookings-harris-beach', 42.052296, -124.299165),
  ('72nd-place-long-beach-ca', 33.757401, -118.146717),
  ('ogunquit-beach-ogunquit-me', 43.248126, -70.596935),
  ('pacific-beach', 32.797429, -117.258157),
  ('pismo-pier-pismo-beach-ca', 35.142, -120.644197),
  ('point-arena-manchester-beach-ca', 38.964235, -123.708007),
  ('rockaway-beach-pacifica-ca', 37.593671, -122.519849),
  ('capitola-capitola-ca', 36.972751, -121.948054),
  ('sandy-hook-sandy-hook-nj', 40.456517, -73.987021),
  ('san-elijo-state-beach', 33.0238, -117.286228),
  ('seal-beach-pier-seal-beach-ca', 33.737367, -118.106661),
  ('flagler-beach-flagler-beach-fl', 29.47498, -81.123904),
  ('solana-beach', 32.9914, -117.274313),
  ('hermosa-beach-pier-hermosa-beach-ca', 33.862029, -118.403696),
  ('stinson-beach-stinson-beach-ca', 37.901642, -122.651027),
  ('hermosa-beach-south-hermosa-beach-ca', 33.856029, -118.401696),
  ('higgins-beach-scarborough-me', 43.565721, -70.281247),
  ('sunset-bay-charleston-or', 43.332353, -124.374403),
  ('imperial-beach', 32.578072, -117.133005),
  ('agate-beach', 44.67365, -124.06345),
  ('jacksonville-beach-pier-jacksonville-beach-fl', 30.293218, -81.388387),
  ('cannon-beach-ecolaindian', 45.898312, -123.96348),
  ('malibu-second-point-malibu-ca', 34.034719, -118.681876),
  ('venice-beach-venice-ca', 33.992186, -118.481634),
  ('bolinas-bolinas-ca', 37.913225, -122.692589),
  ('asbury-park-asbury-park-nj', 40.217297, -74.00103),
  ('morro-rock-sandspit-inside-bend-morro-bay-ca', 35.369676, -120.870862),
  ('bastendorff-beach-coos-bay-or', 43.346619, -124.347969),
  ('la-push-second-beach-la-push-wa', 47.896963, -124.628836),
  ('silver-strand-state-beach', 32.644819, -117.148271),
  ('south-padre-island-isla-blanca-park-south-padre-island-tx', 26.069884, -97.154611),
  ('tourmaline-surf-park', 32.806163, -117.263817),
  ('huntington-state-beach', 33.643081, -117.972377),
  ('k-40-puerto-nuevo', 32.203202, -116.909179),
  ('huntington-beach-pier', 33.655118, -118.004126),
  ('hermosa-pier', 33.860197, -118.401177),
  ('mesa-lane-santa-barbara-ca', 34.397171, -119.732621),
  ('3rd-avenue-beach-bradley-beach-nj', 40.199531, -74.005707),
  ('broadway-beach-cape-may-nj', 38.933147, -74.907382),
  ('doheny', 33.463768, -117.699309),
  ('gold-beach-south-jetty', 42.407026, -124.425803),
  ('hanalei-wainiha-colony-resort', 22.222855, -159.563124),
  ('andrew-molera-river-mouth-big-sur-ca', 36.282423, -121.841887),
  ('3rd-avenue-jetty-belmar-nj', 40.186008, -74.017749),
  ('newport-56th-st', 33.612183, -117.92774),
  ('belmar-fishing-pier-belmar-nj', 40.181639, -74.019275),
  ('kook-bay-spring-lake-nj', 40.15096, -74.023412),
  ('old-mans-sano', 33.380086, -117.575655),
  ('1st-street-jetty-ocean-city-nj', 39.276596, -74.568319),
  ('7th-street-beach-ocean-city-nj', 39.274708, -74.571012),
  ('pacific-city-cape-kiwanda', 45.202097, -123.964194),
  ('agate-street', 33.526549, -117.771456),
  ('brooks-street', 33.531058, -117.774974),
  ('crystal-cove', 33.58313, -117.824087),
  ('ocean-shores', 46.973876, -124.156627),
  ('rincon-carpinteria-ca', 34.371224, -119.455292),
  ('poche-beach', 33.469199, -117.667662),
  ('river-jetties', 33.630165, -117.952829),
  ('renes', 32.263478, -116.998),
  ('brinley-avenue-bradley-beach-nj', 40.195704, -74.013717),
  ('scarborough-beach-scarborough-me', 43.5947, -70.35451),
  ('rosarito-beach', 32.351986, -117.049527),
  ('salt-creek', 33.471397, -117.720065),
  ('teresas', 32.262807, -116.997887),
  ('thalia-street', 33.533001, -117.777011),
  ('garrapata-southern-coves-carmel-ca', 36.469691, -121.907462),
  ('florence-south-jetty', 43.976318, -124.101642),
  ('long-beach-boardwalk', 46.354483, -124.050167),
  ('humbug-mountain-port-orford', 42.741567, -124.496054),
  ('el-morro-point-k375', 32.263307, -116.997746),
  ('seven-presidents-long-branch-nj', 40.288418, -73.982209),
  ('waikoloa-village-lagoon', 19.919291, -155.886836),
  ('washington-beach-spring-lake-nj', 40.156515, -74.019576),
  ('westport-beach', 46.88465, -124.110797);

-- Capture the prior value first, and only for rows we are actually changing.
INSERT INTO public.beach_coordinate_corrections
  (beach_id, slug, old_lat, old_lon, new_lat, new_lon, reason)
SELECT b.id, b.slug, b.lat, b.lon, f.new_lat, f.new_lon,
       'inland-coordinate-audit-2026-08-16: stepped seaward to the waterline (aspect_deg or nearest-water bearing)'
FROM public.beaches b
JOIN _coord_fix f ON f.slug = b.slug
WHERE b.lat IS DISTINCT FROM f.new_lat OR b.lon IS DISTINCT FROM f.new_lon;

UPDATE public.beaches b
SET lat = f.new_lat,
    lon = f.new_lon
FROM _coord_fix f
WHERE f.slug = b.slug
  AND (b.lat IS DISTINCT FROM f.new_lat OR b.lon IS DISTINCT FROM f.new_lon);

COMMIT;

-- ROLLBACK (run manually if these corrections need to be undone):
--
-- BEGIN;
-- UPDATE public.beaches b
-- SET lat = c.old_lat, lon = c.old_lon
-- FROM public.beach_coordinate_corrections c
-- WHERE c.beach_id = b.id
--   AND c.reason LIKE 'inland-coordinate-audit-2026-08-16%';
-- DELETE FROM public.beach_coordinate_corrections
-- WHERE reason LIKE 'inland-coordinate-audit-2026-08-16%';
-- COMMIT;
