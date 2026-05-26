BEGIN;

CREATE OR REPLACE FUNCTION public.update_open_meteo_wind_for_beach(
  p_beach_id uuid,
  p_points jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_updated_count integer := 0;
  v_updated_points integer := 0;
  v_valid_points integer := 0;
BEGIN
  IF p_beach_id IS NULL THEN
    RAISE EXCEPTION 'update_open_meteo_wind_for_beach: p_beach_id is required';
  END IF;

  IF p_points IS NULL OR jsonb_typeof(p_points) <> 'array' THEN
    RAISE EXCEPTION 'update_open_meteo_wind_for_beach: p_points must be a jsonb array';
  END IF;

  WITH raw_points AS (
    SELECT *
    FROM jsonb_to_recordset(p_points) AS point(
      ts text,
      wind_speed_mph numeric,
      wind_direction_deg numeric
    )
  ),
  parseable_points AS (
    SELECT
      ts,
      wind_speed_mph,
      wind_direction_deg
    FROM raw_points
    WHERE ts IS NOT NULL
      AND wind_speed_mph IS NOT NULL
      AND ts ~ '^\d{4}-\d{2}-\d{2}T'
  ),
  valid_points AS (
    SELECT
      ts::timestamptz AS forecast_start,
      wind_speed_mph,
      wind_direction_deg,
      CASE
        WHEN wind_direction_deg IS NULL THEN NULL
        ELSE (
          ARRAY['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
        )[((round(wind_direction_deg / 22.5)::int % 16) + 1)]
      END AS wind_direction
    FROM parseable_points
  ),
  valid_count AS (
    SELECT count(*)::integer AS count FROM valid_points
  ),
  updated AS (
    UPDATE public.enhanced_forecasts ef
    SET
      wind_speed = concat(round(vp.wind_speed_mph)::text, ' mph'),
      wind_direction = vp.wind_direction,
      wind_direction_deg = vp.wind_direction_deg,
      wind_source = 'OPEN_METEO_WIND'
    FROM valid_points vp
    WHERE ef.beach_id = p_beach_id
      AND ef.forecast_at >= vp.forecast_start
      AND ef.forecast_at < vp.forecast_start + interval '1 hour'
      AND (
        ef.wind_source IS NULL
        OR ef.wind_source NOT IN ('HRRR', 'NWS')
      )
    RETURNING ef.id, vp.forecast_start
  ),
  updated_counts AS (
    SELECT
      count(*)::integer AS updated_rows,
      count(DISTINCT forecast_start)::integer AS updated_points
    FROM updated
  )
  SELECT
    vc.count,
    uc.updated_rows,
    uc.updated_points
  INTO
    v_valid_points,
    v_updated_count,
    v_updated_points
  FROM valid_count vc
  CROSS JOIN updated_counts uc;

  RETURN jsonb_build_object(
    'updated_count', COALESCE(v_updated_count, 0),
    'skipped_count', GREATEST(COALESCE(v_valid_points, 0) - COALESCE(v_updated_points, 0), 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_open_meteo_wind_for_beach(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_open_meteo_wind_for_beach(uuid, jsonb) TO service_role;

COMMENT ON FUNCTION public.update_open_meteo_wind_for_beach(uuid, jsonb) IS
  'Set-based Open-Meteo wind update for one beach. Preserves HRRR/NWS priority and avoids PostgREST PATCH OR filters.';

COMMIT;
