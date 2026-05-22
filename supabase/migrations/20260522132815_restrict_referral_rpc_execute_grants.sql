BEGIN;

-- Referral attribution RPCs are auth-guarded internally, but PostgreSQL grants
-- EXECUTE to PUBLIC on new functions by default. Keep these SECURITY DEFINER
-- entrypoints callable only by signed-in clients and service-role jobs.
REVOKE ALL ON FUNCTION public.record_referral_attribution(uuid, uuid, text, text)
  FROM PUBLIC, anon;

REVOKE ALL ON FUNCTION public.accept_invite_for_user(uuid, uuid)
  FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.record_referral_attribution(uuid, uuid, text, text)
  TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.accept_invite_for_user(uuid, uuid)
  TO authenticated, service_role;

COMMIT;
