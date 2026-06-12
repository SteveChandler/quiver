-- Avoid per-row auth.jwt() evaluation in the GFS-Wave shadow RLS policy.

BEGIN;

DROP POLICY IF EXISTS gfs_wave_shadow_forecasts_service_role
  ON public.gfs_wave_shadow_forecasts;

CREATE POLICY gfs_wave_shadow_forecasts_service_role
  ON public.gfs_wave_shadow_forecasts
  FOR ALL
  USING ((select auth.jwt()) ->> 'role' = 'service_role')
  WITH CHECK ((select auth.jwt()) ->> 'role' = 'service_role');

COMMIT;
