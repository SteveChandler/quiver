-- Owners can read objects in their own avatars folder.
--
-- The native app replaces `<user_id>/avatar.jpg` with `upload(..., { upsert: true })`.
-- Storage needs SELECT on the existing object to upsert it, and the avatars bucket has
-- had no SELECT policy since 20260521120000_supabase_advisor_cleanup dropped the broad
-- "Avatar images are publicly readable" policy. Each replacement therefore failed with
-- a 400, and the app fell back to a new `avatar-<ts>.jpg` file every time.
--
-- This policy is scoped to the owner's folder, the same as the INSERT, UPDATE and
-- DELETE policies, so it does not bring back public listing of the bucket. Public
-- avatar URLs keep working because the bucket is public.
--
-- Rollback: DROP POLICY IF EXISTS "Users can read their own avatar" ON storage.objects;

BEGIN;

DROP POLICY IF EXISTS "Users can read their own avatar" ON storage.objects;

CREATE POLICY "Users can read their own avatar"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

COMMIT;
