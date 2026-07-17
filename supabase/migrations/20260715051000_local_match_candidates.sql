-- Keep the native Home "today" recommendations local to the device. Saved
-- beaches remain available through favorite_beaches/My Spots and as the
-- coordinate-free fallback used by existing callers, but they no longer bypass
-- the active radius when valid device coordinates are present. The existing row
-- signature is retained by returning distance/provenance inside the beach JSONB.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_match_candidates(
  p_user_id uuid,
  p_exclude_beach_id uuid DEFAULT NULL::uuid,
  p_device_lat double precision DEFAULT NULL::double precision,
  p_device_lon double precision DEFAULT NULL::double precision,
  p_radius_km double precision DEFAULT 50,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(beach jsonb, score numeric, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_have_device boolean :=
    p_device_lat IS NOT NULL
    AND p_device_lon IS NOT NULL
    AND p_device_lat BETWEEN -90 AND 90
    AND p_device_lon BETWEEN -180 AND 180;
  v_role text := COALESCE(auth.role(), 'anon');
  v_caller uuid := auth.uid();
  v_is_paid boolean := false;
  v_billing_issue boolean := false;
  v_expires_at timestamptz;
  v_max_drive_minutes integer;
  v_profile_radius_km double precision;
  v_effective_radius_km double precision;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_caller IS NULL OR p_user_id <> v_caller THEN
      RETURN;
    END IF;

    SELECT
      COALESCE(ue.is_pro, false) OR COALESCE(ue.is_trialing, false),
      COALESCE(ue.billing_issue, false),
      ue.expires_at
    INTO v_is_paid, v_billing_issue, v_expires_at
    FROM public.user_entitlements ue
    WHERE ue.user_id = p_user_id
    LIMIT 1;

    IF v_billing_issue OR NOT COALESCE(v_is_paid, false) OR (v_expires_at IS NOT NULL AND v_expires_at < now()) THEN
      RETURN;
    END IF;
  END IF;

  SELECT p.max_drive_minutes
  INTO v_max_drive_minutes
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;

  v_profile_radius_km := CASE
    WHEN v_max_drive_minutes IS NULL THEN 100.0
    ELSE
      LEAST(GREATEST(v_max_drive_minutes, 15), 90)
      * 0.5 * 1.609344
  END;
  v_effective_radius_km := LEAST(
    v_profile_radius_km,
    GREATEST(COALESCE(p_radius_km, v_profile_radius_km), 0)
  );

  RETURN QUERY
  WITH device_location AS (
    SELECT ST_SetSRID(ST_MakePoint(p_device_lon, p_device_lat), 4326)::geography AS geog
    WHERE v_have_device
  ),
  local_candidate_beaches AS (
    SELECT
      b.id,
      b.name,
      b.lat,
      b.lon,
      ST_Distance(b.geog, device_location.geog) / 1000.0 AS distance_km,
      'device_radius'::text AS candidate_source
    FROM public.beaches b
    CROSS JOIN device_location
    WHERE v_have_device
      AND b.deleted_at IS NULL
      AND b.geog IS NOT NULL
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND ST_DWithin(
        b.geog,
        device_location.geog,
        v_effective_radius_km * 1000
      )
  ),
  favorite_candidate_beaches AS (
    SELECT
      b.id,
      b.name,
      b.lat,
      b.lon,
      NULL::double precision AS distance_km,
      'favorite'::text AS candidate_source
    FROM public.beaches b
    WHERE NOT v_have_device
      AND b.deleted_at IS NULL
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND EXISTS (
        SELECT 1
        FROM public.favorite_beaches fb
        WHERE fb.user_id = p_user_id
          AND fb.beach_id = b.id
      )
  ),
  combined_candidate_beaches AS (
    SELECT * FROM local_candidate_beaches
    UNION ALL
    SELECT * FROM favorite_candidate_beaches
  ),
  actionable_forecast AS (
    SELECT DISTINCT ON (ef.beach_id)
      ef.beach_id,
      ef.wave_height,
      ef.wave_period,
      ef.wind_speed,
      (ef.wind_direction_deg)::text AS wind_direction,
      ef.tide_height
    FROM public.enhanced_forecasts ef
    WHERE ef.beach_id IN (SELECT id FROM combined_candidate_beaches)
      AND ef.forecast_at IS NOT NULL
      AND ef.forecast_at >= now() - interval '45 minutes'
      AND ef.forecast_at <= now() + interval '72 hours'
    ORDER BY
      ef.beach_id,
      CASE WHEN ef.forecast_at::date = now()::date THEN 0 ELSE 1 END,
      ABS(EXTRACT(EPOCH FROM (ef.forecast_at - now()))),
      ef.forecast_at ASC
  ),
  scored AS (
    SELECT
      cb.id,
      cb.name,
      cb.lat,
      cb.lon,
      cb.distance_km,
      cb.candidate_source,
      public.compute_user_match_score(
        p_user_id,
        cb.id,
        af.wave_height,
        af.wave_period,
        af.wind_speed,
        af.wind_direction,
        af.tide_height
      ) AS result
    FROM combined_candidate_beaches cb
    JOIN actionable_forecast af ON af.beach_id = cb.id
  )
  SELECT
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'lat', s.lat,
      'lon', s.lon,
      'distance_km', s.distance_km,
      'candidate_source', s.candidate_source
    ) AS beach,
    (s.result->>'score')::numeric AS score,
    COALESCE(s.result->>'label', s.result->>'fit_label') AS label
  FROM scored s
  WHERE s.result->>'state' IN ('ready', 'learned')
    AND jsonb_typeof(s.result->'score') = 'number'
  ORDER BY (s.result->>'score')::numeric DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_user_match_candidates(uuid, uuid, double precision, double precision, double precision, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_match_candidates(uuid, uuid, double precision, double precision, double precision, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_match_candidates(uuid, uuid, double precision, double precision, double precision, integer) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
