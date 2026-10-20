-- These SECURITY DEFINER functions have no auth.uid() guard and are only called with the
-- service role (seaside HRRR cron, wind/update, notifications-deliver and system-cards crons;
-- the snapshot repair pair is ops-only). Supabase default privileges left them executable by
-- anon and authenticated via /rest/v1/rpc, so the public anon key could overwrite forecast
-- wind, claim or finalize push deliveries, insert feed posts as any user, and read user_id +
-- arrival_time for up to 5000 completed sessions. bulk_update_hrrr_wind also carries a PUBLIC grant.
-- service_role and postgres keep EXECUTE.
BEGIN;

REVOKE EXECUTE ON FUNCTION public.bulk_update_hrrr_wind(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_open_meteo_wind_for_beach(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_notification_delivery_targets(uuid, text[], uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finalize_notification_delivery_target(uuid, uuid, bigint, text, jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.try_insert_system_feed_post(uuid, uuid, numeric, numeric, text, text, text, boolean, text, jsonb, timestamptz, timestamptz, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_strict_session_snapshots(integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.strict_session_snapshot_repair_candidates(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.bulk_update_hrrr_wind(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_open_meteo_wind_for_beach(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_notification_delivery_targets(uuid, text[], uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_notification_delivery_target(uuid, uuid, bigint, text, jsonb, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.try_insert_system_feed_post(uuid, uuid, numeric, numeric, text, text, text, boolean, text, jsonb, timestamptz, timestamptz, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.repair_strict_session_snapshots(integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.strict_session_snapshot_repair_candidates(integer) TO service_role;

COMMIT;
