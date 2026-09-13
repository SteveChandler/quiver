# Expanded camera release approval plan

This replaces the prior two-camera plan and its approval hash. Production is unchanged.

1. Commit only the camera classifier, two modified test files, camera migration and verification evidence to main. Publish via the existing web release flow, excluding unrelated worktree changes. Verify the deployed revision contains the tested external-provider classifier before applying data.
2. Target production via POSTGRES_URL_NON_POOLING in .env.production.local, verified owner role postgres. Never print credentials.
3. Fresh affected-table backup: /tmp/quiver-camera-sources-20260903.dump (PostgreSQL15 custom-format public.beach_sources backup, archive listing verified). Refresh if more than24 hours old.
4. Recheck current provider playback and exact beach identity, empty camera slots, and migration ledger before applying. Stop for any mismatch or conflicting non-null camera URL.
5. Apply only supabase/migrations/20260903190000_add_verified_provider_cameras.sql; SHA256 085590f8f675b33aae46715d30c51e039ced774b47858535bc1baf3b5316832a. Commit SQL before application and record migration version20260903190000 using the established owner migration-tracking flow. Do not apply other pending migrations.
6. Affected objects: public.beach_sources camera_url for the seven UUIDs listed below, plus the single migration tracking row. No schema, environment, forecast, user-data, or native changes.
7. After application, verify all seven exact URLs, API cam_open_url, and public web link destinations. Six provider pages must return cam_kind=external and embed_allowed=false. Jacksonville uses the existing YouTube click-out renderer (API retains existing YouTube iframe intent). Sources are cached for30 minutes; expire/wait for cache before postflight claims.
8. Rollback only if necessary and separately authorized: restore affected source rows from the fresh backup after checking no newer edits; do not restore the entire table over unrelated changes. Reconcile migration tracking per repository policy.

## Target rows

- Waikiki Beach (HI), 846ccff8-0e26-41f3-8496-5c5221109c6c: https://www.hilton.com/en/hotels/hnlwahf-hilton-waikiki-beach-resort-and-spa/resort/webcam/
- Kalapaki Beach (HI), b2b469ea-3d00-44df-88e8-621934c6926f: https://www.ozolio.com/explore/IDWX000000A6
- Poipu Beach (Kauai) (HI), 231d8635-6ae1-40e5-9112-88c26b0918ac: https://brenneckes.com/beach-webcam/
- Corolla (NC), 885440f6-10c2-4c70-aa40-b7b71044cda3: https://www.corollalightresort.com/surf-cam/
- 7th Street Beach (NJ), 336e967d-86a6-40db-9404-e398b057fefe: https://7thstreetsurfshop.com/wave-cam/7th-street
- Flagler Beach (FL), 9ca1fa2f-2b90-4aa3-8784-48721e5463bb: https://flaglersurf.com/webcam/
- Jacksonville Beach Pier (FL), a4472f56-626e-4905-b909-5f1dc27174a9: https://www.youtube.com/watch?v=c400PBf6adI

## Exact SQL

```sql
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
```
