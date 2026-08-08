BEGIN;

-- California DFG site 6-3-SD-133-D places Tourmaline Surfing Park at the
-- shoreline. The previous point was roughly 300 m inland in Pacific Beach.
UPDATE public.beaches
SET
  lat = 32.805149,
  lon = -117.262364
WHERE id = '17628f35-9ed1-4257-aad6-070c4bd73bb8'::uuid
  AND slug = 'tourmaline'
  AND deleted_at IS NULL
  AND (
    lat IS DISTINCT FROM 32.805149
    OR lon IS DISTINCT FROM -117.262364
  );

COMMIT;
