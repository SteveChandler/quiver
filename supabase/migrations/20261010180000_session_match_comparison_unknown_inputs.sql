-- get_user_session_match_comparison read every missing or unreadable value as 0
-- (parse_numeric_from_text coalesces to 0), so a session logged without a tide
-- or period, or a forecast without wind, produced invented differences such as
-- "tide +3.1 ft", and its COALESCE(..., 99) missing-value penalties never fired.
-- Parse with NULL kept as NULL instead. Same arguments, same response shape;
-- a delta for an unknown value now comes back null. Body otherwise unchanged
-- from the live definition (search_path as set by the advisor cleanup).

BEGIN;

CREATE OR REPLACE FUNCTION public.parse_numeric_or_null(input text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $function$
  SELECT (regexp_match(input, '(-?\d+\.?\d*)'))[1]::numeric;
$function$;

COMMENT ON FUNCTION public.parse_numeric_or_null(text) IS
  'First number in a forecast string ("-1.2 ft" -> -1.2); NULL when there is none, unlike parse_numeric_from_text.';

CREATE OR REPLACE FUNCTION public.get_user_session_match_comparison(p_user_id uuid, p_beach_id uuid, p_wave_height text, p_wave_period text, p_wind_speed text, p_wind_direction text, p_tide_height text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_profile_count integer;
  v_future_wave numeric := public.parse_numeric_or_null(p_wave_height);
  v_future_period numeric := public.parse_numeric_or_null(p_wave_period);
  v_future_wind numeric := public.parse_numeric_or_null(p_wind_speed);
  v_future_wind_dir numeric := public.parse_numeric_or_null(p_wind_direction);
  v_future_tide numeric := public.parse_numeric_or_null(p_tide_height);
  v_positive jsonb;
  v_negative jsonb;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only query own match comparison';
  END IF;

  SELECT COUNT(*)::integer INTO v_profile_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating IS NOT NULL
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL;

  IF v_profile_count < 5 THEN
    RETURN jsonb_build_object(
      'state', 'locked',
      'session_count', v_profile_count,
      'sessions_needed', 5 - v_profile_count
    );
  END IF;

  WITH scored AS (
    SELECT
      s.id,
      s.rating,
      s.arrival_time,
      COALESCE(s.board_snapshot->>'name', b.name) AS board_name,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_height') AS wave_height,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_period') AS wave_period,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'wind_speed') AS wind_speed,
      public.parse_numeric_or_null(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) AS wind_direction,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'tide_height') AS tide_height,
      (
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_height') - v_future_wave), 99) * 0.35 +
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_period') - v_future_period), 99) * 0.20 +
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'wind_speed') - v_future_wind), 99) * 0.15 +
        COALESCE(LEAST(
          ABS(public.parse_numeric_or_null(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) - v_future_wind_dir),
          360 - ABS(public.parse_numeric_or_null(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) - v_future_wind_dir)
        ) / 30, 99) * 0.15 +
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'tide_height') - v_future_tide), 99) * 0.15
      ) AS distance_score
    FROM public.sessions s
    JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    LEFT JOIN public.boards b ON b.id = s.board_id
    WHERE s.user_id = p_user_id
      AND s.status = 'completed'
      AND s.rating IS NOT NULL
      AND s.arrival_time > now() - interval '12 months'
      AND s.deleted_at IS NULL
      AND sfs.forecast_snapshot IS NOT NULL
      AND (s.beach_id = p_beach_id OR p_beach_id IS NULL)
  )
  SELECT jsonb_build_object(
    'session_id', id,
    'rating', rating,
    'arrival_time', arrival_time,
    'board_name', board_name,
    'deltas', jsonb_build_object(
      'waves', round((v_future_wave - wave_height)::numeric, 1),
      'period', round((v_future_period - wave_period)::numeric, 0),
      'wind', round((v_future_wind - wind_speed)::numeric, 0),
      'tide', round((v_future_tide - tide_height)::numeric, 1)
    )
  )
  INTO v_positive
  FROM scored
  WHERE rating >= 4
  ORDER BY distance_score ASC NULLS LAST
  LIMIT 1;

  WITH scored AS (
    SELECT
      s.id,
      s.rating,
      s.arrival_time,
      COALESCE(s.board_snapshot->>'name', b.name) AS board_name,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_height') AS wave_height,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_period') AS wave_period,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'wind_speed') AS wind_speed,
      public.parse_numeric_or_null(sfs.forecast_snapshot->>'tide_height') AS tide_height,
      (
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_height') - v_future_wave), 99) * 0.35 +
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'wave_period') - v_future_period), 99) * 0.25 +
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'wind_speed') - v_future_wind), 99) * 0.20 +
        COALESCE(ABS(public.parse_numeric_or_null(sfs.forecast_snapshot->>'tide_height') - v_future_tide), 99) * 0.20
      ) AS distance_score
    FROM public.sessions s
    JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    LEFT JOIN public.boards b ON b.id = s.board_id
    WHERE s.user_id = p_user_id
      AND s.status = 'completed'
      AND s.rating IS NOT NULL
      AND s.arrival_time > now() - interval '12 months'
      AND s.deleted_at IS NULL
      AND sfs.forecast_snapshot IS NOT NULL
      AND (s.beach_id = p_beach_id OR p_beach_id IS NULL)
  )
  SELECT jsonb_build_object(
    'session_id', id,
    'rating', rating,
    'arrival_time', arrival_time,
    'board_name', board_name
  )
  INTO v_negative
  FROM scored
  WHERE rating <= 2
  ORDER BY distance_score ASC NULLS LAST
  LIMIT 1;

  IF v_positive IS NULL THEN
    RETURN jsonb_build_object(
      'state', 'no_data',
      'session_count', v_profile_count
    );
  END IF;

  RETURN jsonb_build_object(
    'state', 'ready',
    'future', jsonb_build_object(
      'wave_height', p_wave_height,
      'wave_period', p_wave_period,
      'wind_speed', p_wind_speed,
      'wind_direction', p_wind_direction,
      'tide_height', p_tide_height
    ),
    'positive_session', v_positive,
    'negative_session', v_negative,
    'confidence', CASE WHEN v_profile_count >= 20 THEN 'high' WHEN v_profile_count >= 10 THEN 'medium' ELSE 'low' END
  );
END;
$function$
;

COMMIT;
