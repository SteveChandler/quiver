BEGIN;

CREATE TABLE IF NOT EXISTS public.earned_pro_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entitlement_id TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  reason TEXT NOT NULL,
  streak_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT earned_pro_grants_expires_after_granted
    CHECK (expires_at > granted_at)
);

COMMENT ON TABLE public.earned_pro_grants IS
  'Audit and idempotency log for short rolling RevenueCat promotional Pro grants earned through engagement streaks.';

COMMENT ON COLUMN public.earned_pro_grants.reason IS
  'Grant reason key, e.g. weekly_session_streak.';

COMMENT ON COLUMN public.earned_pro_grants.streak_snapshot IS
  'JSON snapshot of streak inputs used when deciding eligibility.';

ALTER TABLE public.earned_pro_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS earned_pro_grants_service_role_all ON public.earned_pro_grants;
CREATE POLICY earned_pro_grants_service_role_all
  ON public.earned_pro_grants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.earned_pro_grants FROM anon, authenticated;
GRANT ALL ON public.earned_pro_grants TO service_role;

CREATE INDEX IF NOT EXISTS idx_earned_pro_grants_user_revoked
  ON public.earned_pro_grants(user_id, revoked_at);

CREATE INDEX IF NOT EXISTS idx_earned_pro_grants_expires_at
  ON public.earned_pro_grants(expires_at);

CREATE INDEX IF NOT EXISTS idx_earned_pro_grants_active_lookup
  ON public.earned_pro_grants(user_id, entitlement_id, expires_at DESC)
  WHERE revoked_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
