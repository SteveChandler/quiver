-- Replaces bulk's beach/profile/board/sun reads with one service-only read.
-- Shared match scoring and entitlement rules remain in the existing Scout RPC.
-- Rollback after reverting the caller: drop get_bulk_forecast_decision_context.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_bulk_forecast_decision_context(
  p_user_id uuid, p_beach_ids uuid[], p_slots jsonb, p_start date, p_end date
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public, pg_temp
AS $context$
WITH runs AS MATERIALIZED (
  (SELECT r.* FROM public.county_beach_advisory_runs r
    WHERE source_identifier = 'county-san-diego-dehq-sdbeachinfo'
    ORDER BY fetched_at DESC LIMIT 1)
  UNION
  (SELECT r.* FROM public.county_beach_advisory_runs r
    WHERE source_identifier = 'county-san-diego-dehq-sdbeachinfo' AND status = 'completed'
    ORDER BY fetched_at DESC LIMIT 1)
)
SELECT jsonb_build_object(
  'beaches', (SELECT coalesce(jsonb_agg(to_jsonb(b)), '[]') FROM (
    SELECT id, name, slug, lat, lon,
      city, state, country, region, timezone,
      break_type, skill_level, cdip_station, cdip_eligible, wind_offshore_deg,
      wind_offshore_tol_deg, wind_cross_shore_ok_kt, wind_onshore_bad_kt, swell_window_center_deg, swell_window_halfwidth_deg,
      swell_access_factors, wind_exposure_factors, preferred_tide_direction, preferred_tide_ft_min, preferred_tide_ft_max,
      tide_direction_sensitivity, preference_model, features, hazards, average_rating,
      review_count, shoaling_factors FROM public.beaches
    WHERE id = ANY(p_beach_ids) AND (NOT coalesce(is_private, false) OR owner_id = p_user_id)) b),
  'profile', (SELECT jsonb_build_object('experience_level',experience_level) FROM public.profiles WHERE id=p_user_id),
  'boards', (SELECT coalesce(jsonb_agg(jsonb_build_object('board_type',board_type)), '[]') FROM public.boards WHERE user_id=p_user_id),
  'sun_times', (SELECT coalesce(jsonb_agg(jsonb_build_object('beach_id',beach_id,
    'sunrise_utc',sunrise_utc,'sunset_utc',sunset_utc) ORDER BY sunrise_utc), '[]')
    FROM public.sun_times WHERE beach_id=ANY(p_beach_ids) AND date BETWEEN p_start AND p_end),
  'personalization', CASE WHEN p_user_id IS NOT NULL THEN
    public.get_week_scout_personalization(p_user_id,p_beach_ids,p_slots) ELSE NULL END,
  'water_quality', jsonb_build_object(
    'beach_water_quality', (SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]') FROM public.beach_water_quality w WHERE beach_id=ANY(p_beach_ids)),
    'water_quality_held_beaches', (SELECT coalesce(jsonb_agg(to_jsonb(w)), '[]') FROM public.water_quality_held_beaches w WHERE beach_id=ANY(p_beach_ids)),
    'county_beach_advisory_runs', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]') FROM runs r),
    'county_beach_advisories', (SELECT coalesce(jsonb_agg(to_jsonb(a)), '[]') FROM public.county_beach_advisories a
      WHERE run_id IN (SELECT id FROM runs) AND beach_id=ANY(p_beach_ids))
  )
);
$context$;
REVOKE ALL ON FUNCTION public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_bulk_forecast_decision_context(uuid,uuid[],jsonb,date,date) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
