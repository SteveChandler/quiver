-- Native Settings reads the signed-in user's profile as `authenticated`.
-- 20260718142000 made new profile columns private until granted; the daily
-- call schema (20260918100000) then added notif_swell_alerts and
-- daily_call_time without a SELECT grant, so the app can save both but never
-- read them back (a select that names them is rejected with 403).
-- Same exposure as the other notif_* columns, but authenticated only (not anon).
-- Rollback: REVOKE SELECT (notif_swell_alerts, daily_call_time) ON TABLE public.profiles FROM authenticated;
BEGIN;

GRANT SELECT (notif_swell_alerts, daily_call_time) ON TABLE public.profiles TO authenticated;

COMMIT;
