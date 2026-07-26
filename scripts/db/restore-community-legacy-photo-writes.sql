-- Exact rollback for the legacy write freeze at the start of
-- 20260725230000_create_community_spot_photos.sql.
-- This restores only the four removed policies and the original write grants.

BEGIN;

DROP POLICY IF EXISTS bps_insert_own ON public.beach_photo_submissions;
CREATE POLICY bps_insert_own ON public.beach_photo_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

DROP POLICY IF EXISTS bps_update_own ON public.beach_photo_submissions;
CREATE POLICY bps_update_own ON public.beach_photo_submissions
  FOR UPDATE
  USING (auth.uid() = submitted_by AND status = 'pending')
  WITH CHECK (auth.uid() = submitted_by AND status = 'pending');

DROP POLICY IF EXISTS bpsv_insert_own ON public.beach_photo_submission_votes;
CREATE POLICY bpsv_insert_own ON public.beach_photo_submission_votes
  FOR INSERT
  WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS bpsv_delete_own ON public.beach_photo_submission_votes;
CREATE POLICY bpsv_delete_own ON public.beach_photo_submission_votes
  FOR DELETE
  USING (auth.uid() = voter_id);

GRANT INSERT, UPDATE, DELETE
  ON public.beach_photo_submissions
  TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE
  ON public.beach_photo_submission_votes
  TO anon, authenticated;

COMMIT;
