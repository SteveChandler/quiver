-- Supabase default privileges grant new public-schema functions directly to
-- anon and authenticated. This SECURITY DEFINER RPC is worker-only.
BEGIN;

REVOKE ALL ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint)
  TO service_role;

COMMIT;
