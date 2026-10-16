-- Record each accepted community-photo terms version once per user.
BEGIN;

CREATE TABLE IF NOT EXISTS public.community_photo_terms_acceptances (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  terms_version text NOT NULL CHECK (
    char_length(terms_version) BETWEEN 1 AND 64
    AND terms_version ~ '^[A-Za-z0-9][A-Za-z0-9._-]*$'
  ),
  accepted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, terms_version)
);

COMMENT ON TABLE public.community_photo_terms_acceptances IS
  'One row per user per accepted community-photo terms version; per-photo ownership attestation remains in community_photo_consents.';

ALTER TABLE public.community_photo_terms_acceptances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_photo_terms_acceptances_select_own ON public.community_photo_terms_acceptances;
CREATE POLICY community_photo_terms_acceptances_select_own ON public.community_photo_terms_acceptances
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS community_photo_terms_acceptances_insert_own ON public.community_photo_terms_acceptances;
CREATE POLICY community_photo_terms_acceptances_insert_own ON public.community_photo_terms_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Client acceptances are immutable; account deletion removes them through the profile cascade.
-- Clients may insert only user_id and terms_version, so accepted_at is always the server's now().
REVOKE ALL ON public.community_photo_terms_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.community_photo_terms_acceptances TO authenticated;
GRANT INSERT (user_id, terms_version) ON public.community_photo_terms_acceptances TO authenticated;
GRANT ALL ON public.community_photo_terms_acceptances TO service_role;

COMMIT;
