BEGIN;

CREATE TABLE public.garmin_accounts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  garmin_user_id TEXT UNIQUE,
  oauth_token TEXT,
  oauth_token_secret TEXT,
  scopes TEXT[],
  designated_activity_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  connected_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

COMMENT ON TABLE public.garmin_accounts IS
  'Per-user Garmin Connect account linkage. OAuth token columns are server-only and are not granted to anon or authenticated roles.';
COMMENT ON COLUMN public.garmin_accounts.designated_activity_types IS
  'User-designated activity types or names that should create Garmin session confirmation candidates.';

ALTER TABLE public.garmin_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY garmin_accounts_owner_select
  ON public.garmin_accounts
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY garmin_accounts_owner_update
  ON public.garmin_accounts
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY garmin_accounts_service_role_all
  ON public.garmin_accounts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.garmin_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  user_id,
  garmin_user_id,
  scopes,
  designated_activity_types,
  connected_at,
  revoked_at
) ON public.garmin_accounts TO authenticated;
GRANT UPDATE (
  designated_activity_types,
  revoked_at
) ON public.garmin_accounts TO authenticated;
GRANT ALL ON TABLE public.garmin_accounts TO service_role;

CREATE TABLE public.garmin_session_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  garmin_activity_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  duration_seconds INT,
  beach_id UUID REFERENCES public.beaches(id),
  state TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT garmin_session_candidates_state_check
    CHECK (state IN ('pending', 'consumed', 'dismissed')),
  CONSTRAINT garmin_session_candidates_user_activity_unique
    UNIQUE (user_id, garmin_activity_id)
);

COMMENT ON TABLE public.garmin_session_candidates IS
  'Pending Garmin activity candidates that require user confirmation before becoming surf sessions.';
COMMENT ON COLUMN public.garmin_session_candidates.garmin_activity_id IS
  'Stable Garmin activity identifier used as the idempotency key.';
COMMENT ON COLUMN public.garmin_session_candidates.state IS
  'Candidate lifecycle state: pending, consumed, or dismissed.';

CREATE INDEX idx_garmin_session_candidates_beach_id
  ON public.garmin_session_candidates(beach_id);

CREATE INDEX idx_garmin_session_candidates_user_state_created
  ON public.garmin_session_candidates(user_id, state, created_at DESC);

ALTER TABLE public.garmin_session_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY garmin_session_candidates_owner_select
  ON public.garmin_session_candidates
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY garmin_session_candidates_owner_update_state
  ON public.garmin_session_candidates
  FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY garmin_session_candidates_service_role_all
  ON public.garmin_session_candidates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.garmin_session_candidates FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.garmin_session_candidates TO authenticated;
GRANT UPDATE (state) ON public.garmin_session_candidates TO authenticated;
GRANT ALL ON TABLE public.garmin_session_candidates TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
