-- Drop the five-argument claim_surf_alert_slot compatibility overload.
--
-- 20260918100000_daily_call_schema re-keyed surf_alert_delivery_slots to
-- (user, date) and introduced the four-argument RPC, keeping a five-argument
-- delegating overload so the worker deployed before that branch kept working.
-- The new worker (quiver #807 / prod slice #808, live 2026-09-17 13:09 PDT)
-- calls the four-argument form only, so the overload is dead.
BEGIN;

DROP FUNCTION IF EXISTS public.claim_surf_alert_slot(uuid, uuid, uuid, date, smallint);

COMMIT;
