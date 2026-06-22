CREATE OR REPLACE FUNCTION public.bulk_update_hrrr_wind(payload jsonb)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH v AS (
    SELECT * FROM jsonb_to_recordset(payload) AS x(
      beach_id uuid,
      hour_start timestamptz,
      wind_speed text,
      wind_direction text,
      wind_direction_deg numeric
    )
  ), upd AS (
    UPDATE enhanced_forecasts ef
    SET wind_speed = v.wind_speed,
        wind_direction = v.wind_direction,
        wind_direction_deg = v.wind_direction_deg,
        wind_source = 'HRRR'
    FROM v
    WHERE ef.beach_id = v.beach_id
      AND ef.forecast_at >= v.hour_start
      AND ef.forecast_at < v.hour_start + INTERVAL '1 hour'
    RETURNING 1
  )
  SELECT count(*)::int FROM upd;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_update_hrrr_wind(jsonb) TO service_role;

COMMENT ON FUNCTION public.bulk_update_hrrr_wind(jsonb) IS
  'Bulk-applies HRRR wind to enhanced_forecasts in one statement. Payload: array of {beach_id, hour_start, wind_speed, wind_direction, wind_direction_deg}. Returns rows updated.';;
