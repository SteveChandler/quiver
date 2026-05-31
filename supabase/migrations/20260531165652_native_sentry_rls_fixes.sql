BEGIN;

-- The shipped native release retries session photo uploads with storage upsert
-- against deterministic object paths. Supabase Storage requires SELECT in
-- addition to INSERT/UPDATE for upsert; the 2026-05-21 advisor cleanup removed
-- the broad public SELECT policy, so restore a narrow owner-scoped SELECT
-- policy for session-media objects.
DROP POLICY IF EXISTS "Users can read their own session media objects" ON storage.objects;
CREATE POLICY "Users can read their own session media objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'session-media'
    AND (select auth.uid())::text = (storage.foldername(name))[2]
  );

-- Keep native direct Supabase analytics aligned with /api/events: tracking is
-- allowed by default and blocked only when the profile explicitly opts out.
-- This avoids RLS failures during short profile/bootstrap race windows and for
-- users whose preference row was created without an explicit true value.
DROP POLICY IF EXISTS "Users can insert their own events" ON public.user_events;
CREATE POLICY "Users can insert their own events"
  ON public.user_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE id = (select auth.uid())
        AND allow_implicit_tracking = false
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
