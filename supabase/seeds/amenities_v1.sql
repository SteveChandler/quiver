-- supabase/seeds/amenities_v1.sql
--
-- Surf Drops V1 amenity scaffold. This is intentionally small and idempotent.
-- It does not pretend to be OSM-derived; rows use source='seed' until the
-- follow-up Overpass importer replaces or augments them with source='osm'.
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
  ('parking_free', 32.75010, -117.25340, 'Ocean Beach main lot area', 'seed', 'seed:san-diego:ocean-beach:parking-free', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('restrooms', 32.75040, -117.25370, 'Ocean Beach public restrooms area', 'seed', 'seed:san-diego:ocean-beach:restrooms', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
  ('showers', 32.75045, -117.25375, 'Ocean Beach shower area', 'seed', 'seed:san-diego:ocean-beach:showers', 45, '{"follow_up":"replace with OSM Overpass import"}'::jsonb),
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
ON CONFLICT (source, source_ref) WHERE source_ref IS NOT NULL DO NOTHING;

COMMIT;
