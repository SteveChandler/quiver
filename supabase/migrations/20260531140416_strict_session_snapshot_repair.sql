BEGIN;

CREATE OR REPLACE FUNCTION public.strict_session_snapshot_repair_candidates(
  p_limit integer DEFAULT 500
)
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  beach_id uuid,
  custom_spot_id uuid,
  arrival_time timestamptz,
  forecast_at timestamptz,
  delta_minutes numeric,
  nearest_beach_distance_mi numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.id AS session_id,
    s.user_id,
    s.beach_id,
    s.custom_spot_id,
    s.arrival_time,
    nearest.forecast_at,
    ROUND((ABS(EXTRACT(EPOCH FROM (nearest.forecast_at - s.arrival_time))) / 60)::numeric, 2) AS delta_minutes,
    cs.nearest_beach_distance_mi
  FROM public.sessions s
  LEFT JOIN public.session_forecast_snapshots sfs
    ON sfs.session_id = s.id
  LEFT JOIN public.custom_spots cs
    ON cs.id = s.custom_spot_id
  JOIN LATERAL (
    SELECT ef.*
    FROM public.enhanced_forecasts ef
    WHERE ef.beach_id = s.beach_id
      AND ef.forecast_at IS NOT NULL
      AND ef.forecast_at BETWEEN s.arrival_time - interval '90 minutes'
        AND s.arrival_time + interval '90 minutes'
    ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_at - s.arrival_time))) ASC
    LIMIT 1
  ) nearest ON true
  WHERE s.status = 'completed'
    AND s.rating IS NOT NULL
    AND s.beach_id IS NOT NULL
    AND (
      sfs.session_id IS NULL
      OR sfs.forecast_snapshot IS NULL
      OR jsonb_typeof(sfs.forecast_snapshot) <> 'object'
    )
    AND (
      s.custom_spot_id IS NULL
      OR (
        cs.nearest_beach_id = s.beach_id
        AND cs.nearest_beach_distance_mi IS NOT NULL
        AND cs.nearest_beach_distance_mi <= 5
      )
    )
  ORDER BY s.arrival_time DESC
  LIMIT GREATEST(1, LEAST(p_limit, 5000));
$function$;

CREATE OR REPLACE FUNCTION public.repair_strict_session_snapshots(
  p_limit integer DEFAULT 100,
  p_apply boolean DEFAULT false
)
RETURNS TABLE (
  session_id uuid,
  user_id uuid,
  beach_id uuid,
  forecast_at timestamptz,
  delta_minutes numeric,
  repaired boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT p_apply THEN
    RETURN QUERY
    SELECT
      c.session_id,
      c.user_id,
      c.beach_id,
      c.forecast_at,
      c.delta_minutes,
      false AS repaired
    FROM public.strict_session_snapshot_repair_candidates(p_limit) c;
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT * FROM public.strict_session_snapshot_repair_candidates(p_limit)
  ),
  source_rows AS (
    SELECT
      c.session_id,
      c.user_id,
      c.beach_id,
      c.forecast_at,
      c.delta_minutes,
      s.arrival_time,
      s.rating,
      s.wave_quality,
      s.wave_height_ft,
      s.crowd_level,
      s.duration_minutes,
      ef
    FROM candidates c
    JOIN public.sessions s ON s.id = c.session_id
    JOIN public.enhanced_forecasts ef
      ON ef.beach_id = c.beach_id
      AND ef.forecast_at = c.forecast_at
  ),
  inserted AS (
    INSERT INTO public.session_forecast_snapshots (
      session_id,
      user_id,
      beach_id,
      forecast_snapshot,
      actual_conditions,
      forecast_confidence_score,
      data_source,
      session_date
    )
    SELECT
      sr.session_id,
      sr.user_id,
      sr.beach_id,
      to_jsonb(sr.ef),
      jsonb_build_object(
        'arrival_time', sr.arrival_time,
        'rating', sr.rating,
        'wave_quality', sr.wave_quality,
        'wave_height_ft', sr.wave_height_ft,
        'crowd_level', sr.crowd_level,
        'duration_minutes', sr.duration_minutes
      ),
      NULLIF(sr.ef.confidence_score::text, '')::integer,
      sr.ef.data_source,
      sr.arrival_time::date
    FROM source_rows sr
    ON CONFLICT (session_id) DO NOTHING
    RETURNING session_id
  )
  SELECT
    sr.session_id,
    sr.user_id,
    sr.beach_id,
    sr.forecast_at,
    sr.delta_minutes,
    inserted.session_id IS NOT NULL AS repaired
  FROM source_rows sr
  LEFT JOIN inserted ON inserted.session_id = sr.session_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.strict_session_snapshot_repair_candidates(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.repair_strict_session_snapshots(integer, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.strict_session_snapshot_repair_candidates(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.repair_strict_session_snapshots(integer, boolean) TO service_role;

COMMENT ON FUNCTION public.repair_strict_session_snapshots(integer, boolean) IS
  'Strict same-beach +/-90 minute session snapshot repair. p_apply=false previews only; production apply requires explicit approval.';

NOTIFY pgrst, 'reload schema';

COMMIT;
