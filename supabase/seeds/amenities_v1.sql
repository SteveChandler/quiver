-- supabase/seeds/amenities_v1.sql
--
-- Surf Drops V1 amenity scaffold. This is intentionally small and idempotent.
-- Rows use source='seed' for this curated bootstrap set; raw records carry
-- coordinate provenance when a point was corrected from OpenStreetMap.
--
-- Apply with: psql ... -f supabase/seeds/amenities_v1.sql

BEGIN;

INSERT INTO public.amenities (
  amenity_type,
  lat,
  lon,
  label,
  source,
  source_ref,
  confidence,
  raw
)
VALUES
  ('parking_free', 32.7492797, -117.2521646, 'Ocean Beach main lot', 'seed', 'seed:san-diego:ocean-beach:parking-free', 85, '{"coordinate_source":"openstreetmap","osm_ref":"way/69707065"}'::jsonb),
  ('restrooms', 32.7490172, -117.2523221, 'Ocean Beach public restrooms', 'seed', 'seed:san-diego:ocean-beach:restrooms', 85, '{"coordinate_source":"openstreetmap","osm_ref":"node/1405217348"}'::jsonb),
  ('showers', 32.7491611, -117.2525285, 'Ocean Beach public showers', 'seed', 'seed:san-diego:ocean-beach:showers', 85, '{"coordinate_source":"openstreetmap","osm_ref":"node/833662681"}'::jsonb),
  ('lifeguard', 32.7490266, -117.2525000, 'Ocean Beach lifeguard tower - south', 'seed', 'seed:san-diego:ocean-beach:lifeguard-south', 85, '{"coordinate_source":"openstreetmap","osm_ref":"node/8972460308"}'::jsonb),
  ('lifeguard', 32.7496549, -117.2526707, 'Ocean Beach lifeguard tower - central', 'seed', 'seed:san-diego:ocean-beach:lifeguard-central', 85, '{"coordinate_source":"openstreetmap","osm_ref":"node/8972519418"}'::jsonb),
  ('lifeguard', 32.7513951, -117.2524818, 'Ocean Beach lifeguard tower - north', 'seed', 'seed:san-diego:ocean-beach:lifeguard-north', 85, '{"coordinate_source":"openstreetmap","osm_ref":"node/8972460296"}'::jsonb),
  ('lifeguard', 32.7526758, -117.2525127, 'Ocean Beach lifeguard tower - far north', 'seed', 'seed:san-diego:ocean-beach:lifeguard-far-north', 85, '{"coordinate_source":"openstreetmap","osm_ref":"node/8972460305"}'::jsonb),
  ('beach_access', 32.93290, -117.26060, 'Torrey Pines beach access area', 'seed', 'seed:san-diego:torrey-pines:beach-access', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('parking_paid', 34.00880, -118.49970, 'Santa Monica beach parking area', 'seed', 'seed:la:santa-monica:parking-paid', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('restrooms', 34.00860, -118.49940, 'Santa Monica restroom area', 'seed', 'seed:la:santa-monica:restrooms', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('bike_parking', 34.00850, -118.49910, 'Santa Monica bike parking area', 'seed', 'seed:la:santa-monica:bike-parking', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('parking_paid', 37.76910, -122.51120, 'Ocean Beach SF parking area', 'seed', 'seed:sf:ocean-beach:parking-paid', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('restrooms', 37.76900, -122.51070, 'Ocean Beach SF restroom area', 'seed', 'seed:sf:ocean-beach:restrooms', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('transit_stop', 37.76870, -122.50990, 'Ocean Beach SF transit stop area', 'seed', 'seed:sf:ocean-beach:transit-stop', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('parking_free', 21.66520, -158.05320, 'Ehukai beach parking area', 'seed', 'seed:oahu:ehukai:parking-free', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('restrooms', 21.66540, -158.05300, 'Ehukai public restroom area', 'seed', 'seed:oahu:ehukai:restrooms', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('showers', 21.66545, -158.05295, 'Ehukai shower area', 'seed', 'seed:oahu:ehukai:showers', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('lifeguard', 21.66560, -158.05280, 'Ehukai lifeguard tower area', 'seed', 'seed:oahu:ehukai:lifeguard', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb)
ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO UPDATE
SET
  amenity_type = EXCLUDED.amenity_type,
  lat = EXCLUDED.lat,
  lon = EXCLUDED.lon,
  label = EXCLUDED.label,
  confidence = EXCLUDED.confidence,
  raw = EXCLUDED.raw;

COMMIT;
