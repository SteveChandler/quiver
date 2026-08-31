-- Move PB Point from its approximate Pacific Beach pin to Surfline's published
-- PB Point marker. The exact coordinate is encoded in Surfline spot
-- 5842041f4e65fad6a77088c2's pinned chart location:
-- https://www.surfline.com/surf-report/pb-point/5842041f4e65fad6a77088c2/surf-charts/@32.80662846492798,-117.26888,7z?pinnedLocation=-117.26888,32.80662846492798&type=wave-height

BEGIN;

DO $$
DECLARE
  current_lat double precision;
  current_lon double precision;
BEGIN
  SELECT lat, lon
  INTO STRICT current_lat, current_lon
  FROM public.beaches
  WHERE id = '13ef0aa1-c857-4d82-a40d-a83612110943'::uuid
    AND slug = 'pb-point';

  IF (current_lat, current_lon) = (32.80662846492798, -117.26888) THEN
    RETURN;
  END IF;

  IF (current_lat, current_lon) IS DISTINCT FROM (32.7998, -117.2623) THEN
    RAISE EXCEPTION
      'PB Point coordinates changed unexpectedly: lat=%, lon=%',
      current_lat,
      current_lon;
  END IF;
END
$$;

INSERT INTO public.beach_coordinate_corrections
  (beach_id, slug, old_lat, old_lon, new_lat, new_lon, reason)
SELECT
  id,
  slug,
  lat,
  lon,
  32.80662846492798,
  -117.26888,
  'surfline-pb-point-2026-08-31: exact pinned chart coordinate for Surfline spot 5842041f4e65fad6a77088c2'
FROM public.beaches
WHERE id = '13ef0aa1-c857-4d82-a40d-a83612110943'::uuid
  AND slug = 'pb-point'
  AND (lat, lon) IS DISTINCT FROM (32.80662846492798, -117.26888);

UPDATE public.beaches
SET lat = 32.80662846492798,
    lon = -117.26888
WHERE id = '13ef0aa1-c857-4d82-a40d-a83612110943'::uuid
  AND slug = 'pb-point'
  AND (lat, lon) IS DISTINCT FROM (32.80662846492798, -117.26888);

COMMIT;

-- ROLLBACK (run manually if Surfline changes or removes this spot marker):
--
-- BEGIN;
-- UPDATE public.beaches b
-- SET lat = c.old_lat, lon = c.old_lon
-- FROM public.beach_coordinate_corrections c
-- WHERE c.beach_id = b.id
--   AND c.reason LIKE 'surfline-pb-point-2026-08-31%';
-- COMMIT;
