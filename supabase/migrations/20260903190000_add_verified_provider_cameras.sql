-- Verified provider playback and geography on 2026-09-03.
-- Deploy external-link classification before applying this data migration.
-- No schema changes. Preserve existing cameras and all forecast settings.
BEGIN;

INSERT INTO public.beach_sources (beach_id, camera_url)
SELECT b.id, cams.camera_url
FROM (VALUES
  ('846ccff8-0e26-41f3-8496-5c5221109c6c'::uuid, 'waikiki-beach', 'https://www.hilton.com/en/hotels/hnlwahf-hilton-waikiki-beach-resort-and-spa/resort/webcam/'),
  ('b2b469ea-3d00-44df-88e8-621934c6926f'::uuid, 'kalapaki-beach', 'https://www.ozolio.com/explore/IDWX000000A6'),
  ('231d8635-6ae1-40e5-9112-88c26b0918ac'::uuid, 'poipu-beach-kauai', 'https://brenneckes.com/beach-webcam/'),
  ('885440f6-10c2-4c70-aa40-b7b71044cda3'::uuid, 'corolla-corolla-nc', 'https://www.corollalightresort.com/surf-cam/'),
  ('336e967d-86a6-40db-9404-e398b057fefe'::uuid, '7th-street-beach-ocean-city-nj', 'https://7thstreetsurfshop.com/wave-cam/7th-street'),
  ('9ca1fa2f-2b90-4aa3-8784-48721e5463bb'::uuid, 'flagler-beach-flagler-beach-fl', 'https://flaglersurf.com/webcam/'),
  ('a4472f56-626e-4905-b909-5f1dc27174a9'::uuid, 'jacksonville-beach-pier-jacksonville-beach-fl', 'https://www.youtube.com/watch?v=c400PBf6adI')
) AS cams(beach_id, slug, camera_url)
JOIN public.beaches b ON b.id = cams.beach_id AND b.slug = cams.slug
WHERE b.deleted_at IS NULL
ON CONFLICT (beach_id) DO UPDATE
SET camera_url = EXCLUDED.camera_url
WHERE beach_sources.camera_url IS NULL;

COMMIT;
