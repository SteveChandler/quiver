BEGIN;

CREATE TABLE public.user_beach_exclusions (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, beach_id)
);

COMMENT ON TABLE public.user_beach_exclusions IS
  'Per-user beach blocklist used to remove disliked beaches from personalized discovery candidates.';

CREATE INDEX user_beach_exclusions_user_id_idx
  ON public.user_beach_exclusions(user_id);

ALTER TABLE public.user_beach_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_beach_exclusions_select_own
  ON public.user_beach_exclusions
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY user_beach_exclusions_insert_own
  ON public.user_beach_exclusions
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY user_beach_exclusions_delete_own
  ON public.user_beach_exclusions
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

REVOKE ALL ON TABLE public.user_beach_exclusions FROM PUBLIC;
GRANT ALL ON TABLE public.user_beach_exclusions TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
