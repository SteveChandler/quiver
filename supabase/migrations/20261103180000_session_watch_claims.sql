-- Phone-logged sessions claim the watch recording they describe, so a watch import attaches by
-- claim instead of guessing from arrival time (2026-11-03: a phone save 84 min after the watch's
-- in-water start only attached because the window was 90 min).
-- 1. sessions.timing_user_set: true when the user explicitly set time or duration on the phone.
--    The importer keeps phone timing only when it is set; untouched defaults take the watch's.
-- 2. session_watch_claims: one claim per session, written by the owner after saving; the importer
--    (service role) fills claimed_* and merge_result when a watch import attaches to the session.
-- Rollback: DROP TABLE public.session_watch_claims; ALTER TABLE public.sessions DROP COLUMN timing_user_set;
BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS timing_user_set boolean NOT NULL DEFAULT false;
-- authenticated holds table-level SELECT/INSERT/UPDATE on sessions (checked 2026-11-03), which covers
-- the new column; restated per column so a later table-level revoke cannot silently drop it.
GRANT SELECT (timing_user_set), INSERT (timing_user_set), UPDATE (timing_user_set) ON public.sessions TO authenticated;

CREATE TABLE IF NOT EXISTS public.session_watch_claims (
  session_id uuid PRIMARY KEY REFERENCES public.sessions ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  device_id uuid REFERENCES public.watch_devices ON DELETE SET NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  claimed_import_id uuid REFERENCES public.session_imports ON DELETE SET NULL,
  claimed_at timestamptz,
  -- { mergedFields: text[], keptFields: [{ field, phoneValue, watchValue }] } recorded at merge time.
  merge_result jsonb,
  -- A bounded window keeps one stale claim from swallowing every later watch surf.
  CONSTRAINT session_watch_claims_window_check
    CHECK (window_end > window_start AND window_end - window_start <= interval '24 hours')
);

CREATE INDEX IF NOT EXISTS session_watch_claims_user_window_idx
  ON public.session_watch_claims (user_id, window_end);
CREATE INDEX IF NOT EXISTS session_watch_claims_device_id_idx
  ON public.session_watch_claims (device_id);
CREATE INDEX IF NOT EXISTS session_watch_claims_claimed_import_id_idx
  ON public.session_watch_claims (claimed_import_id);

ALTER TABLE public.session_watch_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS session_watch_claims_select_own ON public.session_watch_claims;
CREATE POLICY session_watch_claims_select_own ON public.session_watch_claims
  FOR SELECT TO authenticated USING (user_id = (select auth.uid()));
-- The claimed session and device must both be the caller's, or a user could point a claim at
-- another user's session.
DROP POLICY IF EXISTS session_watch_claims_insert_own ON public.session_watch_claims;
CREATE POLICY session_watch_claims_insert_own ON public.session_watch_claims
  FOR INSERT TO authenticated WITH CHECK (
    user_id = (select auth.uid())
    AND EXISTS (SELECT 1 FROM public.sessions s
      WHERE s.id = session_id AND s.user_id = (select auth.uid()) AND s.deleted_at IS NULL)
    AND (device_id IS NULL OR EXISTS (SELECT 1 FROM public.watch_devices d
      WHERE d.id = device_id AND d.user_id = (select auth.uid())))
  );
DROP POLICY IF EXISTS session_watch_claims_delete_own ON public.session_watch_claims;
CREATE POLICY session_watch_claims_delete_own ON public.session_watch_claims
  FOR DELETE TO authenticated USING (user_id = (select auth.uid()));

REVOKE ALL ON public.session_watch_claims FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.session_watch_claims TO authenticated;
-- Owners write only the claim itself; claimed_* and merge_result are the importer's.
GRANT INSERT (session_id, user_id, device_id, window_start, window_end) ON public.session_watch_claims TO authenticated;
GRANT ALL ON public.session_watch_claims TO service_role;

COMMIT;
