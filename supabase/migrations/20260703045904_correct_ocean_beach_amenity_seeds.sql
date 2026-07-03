BEGIN;

-- Correct the curated Ocean Beach amenity bootstrap rows that were placed
-- offshore and add the missing lifeguard tower markers. Coordinates are from
-- OpenStreetMap Overpass results captured 2026-07-03; source stays "seed"
-- because this is the curated V1 bootstrap set, not the full OSM importer.
WITH desired_amenities (
  amenity_type,
  lat,
  lon,
  label,
  source_ref,
  confidence,
  osm_ref
) AS (
  VALUES
    ('parking_free', 32.7492797, -117.2521646, 'Ocean Beach main lot', 'seed:san-diego:ocean-beach:parking-free', 85, 'way/69707065'),
    ('restrooms', 32.7490172, -117.2523221, 'Ocean Beach public restrooms', 'seed:san-diego:ocean-beach:restrooms', 85, 'node/1405217348'),
    ('showers', 32.7491611, -117.2525285, 'Ocean Beach public showers', 'seed:san-diego:ocean-beach:showers', 85, 'node/833662681'),
    ('lifeguard', 32.7490266, -117.2525000, 'Ocean Beach lifeguard tower - south', 'seed:san-diego:ocean-beach:lifeguard-south', 85, 'node/8972460308'),
    ('lifeguard', 32.7496549, -117.2526707, 'Ocean Beach lifeguard tower - central', 'seed:san-diego:ocean-beach:lifeguard-central', 85, 'node/8972519418'),
    ('lifeguard', 32.7513951, -117.2524818, 'Ocean Beach lifeguard tower - north', 'seed:san-diego:ocean-beach:lifeguard-north', 85, 'node/8972460296'),
    ('lifeguard', 32.7526758, -117.2525127, 'Ocean Beach lifeguard tower - far north', 'seed:san-diego:ocean-beach:lifeguard-far-north', 85, 'node/8972460305')
)
UPDATE public.amenities AS a
SET
  amenity_type = d.amenity_type,
  lat = d.lat,
  lon = d.lon,
  label = d.label,
  confidence = d.confidence,
  raw = jsonb_build_object(
    'coordinate_source', 'openstreetmap',
    'osm_ref', d.osm_ref,
    'corrected_at', '2026-07-03'
  )
FROM desired_amenities AS d
WHERE a.source = 'seed'
  AND a.source_ref = d.source_ref;

WITH desired_amenities (
  amenity_type,
  lat,
  lon,
  label,
  source_ref,
  confidence,
  osm_ref
) AS (
  VALUES
    ('parking_free', 32.7492797, -117.2521646, 'Ocean Beach main lot', 'seed:san-diego:ocean-beach:parking-free', 85, 'way/69707065'),
    ('restrooms', 32.7490172, -117.2523221, 'Ocean Beach public restrooms', 'seed:san-diego:ocean-beach:restrooms', 85, 'node/1405217348'),
    ('showers', 32.7491611, -117.2525285, 'Ocean Beach public showers', 'seed:san-diego:ocean-beach:showers', 85, 'node/833662681'),
    ('lifeguard', 32.7490266, -117.2525000, 'Ocean Beach lifeguard tower - south', 'seed:san-diego:ocean-beach:lifeguard-south', 85, 'node/8972460308'),
    ('lifeguard', 32.7496549, -117.2526707, 'Ocean Beach lifeguard tower - central', 'seed:san-diego:ocean-beach:lifeguard-central', 85, 'node/8972519418'),
    ('lifeguard', 32.7513951, -117.2524818, 'Ocean Beach lifeguard tower - north', 'seed:san-diego:ocean-beach:lifeguard-north', 85, 'node/8972460296'),
    ('lifeguard', 32.7526758, -117.2525127, 'Ocean Beach lifeguard tower - far north', 'seed:san-diego:ocean-beach:lifeguard-far-north', 85, 'node/8972460305')
)
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
SELECT
  d.amenity_type,
  d.lat,
  d.lon,
  d.label,
  'seed',
  d.source_ref,
  d.confidence,
  jsonb_build_object(
    'coordinate_source', 'openstreetmap',
    'osm_ref', d.osm_ref,
    'corrected_at', '2026-07-03'
  )
FROM desired_amenities AS d
WHERE NOT EXISTS (
  SELECT 1
  FROM public.amenities AS existing
  WHERE existing.source = 'seed'
    AND existing.source_ref = d.source_ref
);

COMMIT;
