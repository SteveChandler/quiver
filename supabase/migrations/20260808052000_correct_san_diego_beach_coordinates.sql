-- Keep the shared beach catalog centered on the actual surf breaks used by
-- native and web map experiences. The generated geog column follows lat/lon.

BEGIN;

DO $$
DECLARE
  updated_count integer;
BEGIN
  WITH corrections(id, expected_name, lat, lon) AS (
    VALUES
      ('d291411d-d331-4bf1-ad1a-302da3c69de0'::uuid, 'La Jolla Shores', 32.856700, -117.257500),
      ('17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid, 'Tourmaline Beach', 32.805149, -117.262364),
      ('ca2b1d6f-2428-4273-ab02-7555eeec4323'::uuid, 'Birdrock', 32.815031, -117.273505)
  ),
  updated AS (
    UPDATE public.beaches AS beach
    SET
      lat = correction.lat,
      lon = correction.lon
    FROM corrections AS correction
    WHERE beach.id = correction.id
      AND beach.name = correction.expected_name
    RETURNING beach.id
  )
  SELECT count(*) INTO updated_count FROM updated;

  IF updated_count <> 3 THEN
    RAISE EXCEPTION
      'Expected to correct 3 San Diego beaches, corrected %; catalog identities changed',
      updated_count;
  END IF;
END
$$;

COMMIT;
