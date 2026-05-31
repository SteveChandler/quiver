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
SET search_path TO 'public'
AS $function$
DECLARE
  v_have_device boolean := p_device_lat IS NOT NULL AND p_device_lon IS NOT NULL;
  v_role text := COALESCE(auth.role(), 'anon');
  v_caller uuid := auth.uid();
  v_is_paid boolean := false;
  v_billing_issue boolean := false;
  v_expires_at timestamptz;
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

  RETURN QUERY
  WITH candidate_beaches AS (
    SELECT DISTINCT b.id, b.name, b.lat, b.lon
    FROM public.beaches b
    WHERE b.deleted_at IS NULL
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND b.id IN (
        SELECT fb.beach_id FROM public.favorite_beaches fb WHERE fb.user_id = p_user_id
        UNION
        SELECT b2.id
        FROM public.beaches b2
        WHERE v_have_device
          AND b2.geog IS NOT NULL
          AND ST_DWithin(
            b2.geog,
            ST_SetSRID(ST_MakePoint(p_device_lon, p_device_lat), 4326)::geography,
            p_radius_km * 1000
          )
      )
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
    WHERE ef.beach_id IN (SELECT id FROM candidate_beaches)
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
      public.compute_user_match_score(
        p_user_id,
        cb.id,
        af.wave_height,
        af.wave_period,
        af.wind_speed,
        af.wind_direction,
        af.tide_height
      ) AS result
    FROM candidate_beaches cb
    JOIN actionable_forecast af ON af.beach_id = cb.id
  )
  SELECT
    jsonb_build_object('id', s.id, 'name', s.name, 'lat', s.lat, 'lon', s.lon) AS beach,
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
