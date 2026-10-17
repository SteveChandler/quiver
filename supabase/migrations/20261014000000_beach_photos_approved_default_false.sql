-- beach_photos.approved defaulted to true, so a writer that left `approved` out published straight to
-- beach heroes. That is how Blacks Beach showed a Venice Beach photo: Openverse rows fetched in Oct 2025,
-- before scripts/fetch-beach-photos.ts set approved = false, took the default. Every current writer names
-- `approved` (curated migration inserts, the admin session-photo promotion, the fetch script), so this
-- changes no live write path; it makes the next writer that forgets fail closed into the review queue.
-- Metadata-only: no table rewrite, existing rows keep their value.
-- Rollback: ALTER TABLE public.beach_photos ALTER COLUMN approved SET DEFAULT true;
BEGIN;
SET LOCAL lock_timeout = '2s';

ALTER TABLE public.beach_photos ALTER COLUMN approved SET DEFAULT false;

COMMENT ON COLUMN public.beach_photos.approved IS
  'Moderation flag. Only approved=true photos appear in public beach listings. Defaults to false so a writer that omits it lands in admin review; curated inserts set true explicitly.';

COMMIT;
