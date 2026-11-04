-- Match forecasts to buoy readings when they are read, instead of Seaside's
-- backfill-observations writing observed_m back onto every ml_predictions_log
-- row (2026-11-03 incident: 2-3 PostgREST calls per row, ~13.7k rows a day,
-- backlog and 8 s timeouts since Oct 30).
--
-- 68% of matched beach-hours come through get_beach_observation_station, not
-- the station's nearest_beach_id, and that function costs ~0.4 s a call. So the
-- beach -> station mapping is resolved once a day into a materialized view and
-- matching joins on station_id, which reproduced 99% of stored matches for
-- Oct 22-28. Existing observed_m values are left in place; nothing writes back.

BEGIN;

CREATE MATERIALIZED VIEW public.beach_observation_stations AS
SELECT mapped.beach_id, mapped.station_id
FROM (
  SELECT b.id AS beach_id, public.get_beach_observation_station(b.id) AS station_id
  FROM public.beaches b
) mapped
WHERE mapped.station_id IS NOT NULL
WITH DATA;

CREATE UNIQUE INDEX beach_observation_stations_beach_id_idx ON public.beach_observation_stations (beach_id);

REVOKE ALL ON public.beach_observation_stations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.beach_observation_stations TO service_role;

COMMENT ON MATERIALIZED VIEW public.beach_observation_stations IS
  'Daily snapshot of get_beach_observation_station per beach, so read-time buoy matching never calls the ~0.4 s resolver per row. Refreshed by refresh_beach_observation_stations().';

CREATE OR REPLACE FUNCTION public.refresh_beach_observation_stations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.beach_observation_stations;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_beach_observation_stations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_beach_observation_stations() TO service_role;

-- One prediction row per match: the nearest reading at the beach's station
-- within ±12 hours of predicted_at (earlier reading on a tie). Predictions with
-- no station or no reading are omitted. NULL p_beach_id means all beaches.
CREATE OR REPLACE FUNCTION public.get_prediction_observations(
  p_beach_id uuid,
  p_since timestamptz,
  p_until timestamptz
)
RETURNS TABLE (
  prediction_id uuid,
  beach_id uuid,
  predicted_at timestamptz,
  forecast_horizon_hours integer,
  forecast_horizon_bucket text,
  raw_display_height_m numeric,
  offset_corrected_display_height_m numeric,
  v5_shadow_height_m numeric,
  wave_height_om real,
  station_id text,
  observed_at timestamptz,
  observed_m numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- PostgREST cancels at 8 s; a month of all beaches is ~18 s, so callers page by beach.
  IF p_until - p_since > interval '31 days' THEN
    RAISE EXCEPTION 'get_prediction_observations: range % to % exceeds 31 days', p_since, p_until
      USING ERRCODE = '22023';
  END IF;

  -- Each beach-hour is logged once per horizon bucket (3 rows), so look the
  -- reading up once per slot and join it back: 33 ms vs 1.4 s for one beach-month.
  RETURN QUERY
  WITH slots AS MATERIALIZED (
    SELECT DISTINCT p.beach_id, p.predicted_at, s.station_id
    FROM public.ml_predictions_log p
    JOIN public.beach_observation_stations s ON s.beach_id = p.beach_id
    WHERE p.predicted_at >= p_since
      AND p.predicted_at < p_until
      AND (p_beach_id IS NULL OR p.beach_id = p_beach_id)
  ),
  matched AS (
    SELECT sl.beach_id, sl.predicted_at, sl.station_id, o.observed_at, o.wave_height_m
    FROM slots sl
    CROSS JOIN LATERAL (
      SELECT u.observed_at, u.wave_height_m
      FROM public.unified_wave_observations u
      WHERE u.station_id = sl.station_id
        AND u.wave_height_m > 0
        AND u.observed_at >= sl.predicted_at - interval '12 hours'
        AND u.observed_at <= sl.predicted_at + interval '12 hours'
      ORDER BY abs(extract(epoch from (u.observed_at - sl.predicted_at))), u.observed_at
      LIMIT 1
    ) o
  )
  SELECT
    p.id,
    p.beach_id,
    p.predicted_at,
    p.forecast_horizon_hours,
    p.forecast_horizon_bucket,
    p.raw_display_height_m,
    p.offset_corrected_display_height_m,
    p.v5_shadow_height_m,
    p.wave_height_om,
    m.station_id,
    m.observed_at,
    m.wave_height_m
  FROM public.ml_predictions_log p
  JOIN matched m ON m.beach_id = p.beach_id AND m.predicted_at = p.predicted_at
  WHERE p.predicted_at >= p_since
    AND p.predicted_at < p_until
    AND (p_beach_id IS NULL OR p.beach_id = p_beach_id)
  ORDER BY p.predicted_at, p.id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_prediction_observations(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_prediction_observations(uuid, timestamptz, timestamptz) TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobname)
    FROM cron.job
    WHERE jobname = 'refresh-beach-observation-stations';

    PERFORM cron.schedule(
      'refresh-beach-observation-stations',
      '15 9 * * *',
      $cron$SELECT public.refresh_beach_observation_stations();$cron$
    );
  ELSE
    RAISE NOTICE 'pg_cron not available; beach observation station refresh was not scheduled';
  END IF;
END $$;

-- Session snapshots: snapshot_buoy_observed_m used to copy the nearest
-- prediction's written-back observed_m, which the backfill rarely had filled by
-- the time a session was saved (30 of 279 candidates). Read the buoy for that
-- prediction at read time instead. Body is otherwise unchanged from
-- 20261021200000_session_wave_size_vs_forecast.sql (matches prod); grants persist
-- across CREATE OR REPLACE.
CREATE OR REPLACE FUNCTION public.sync_session_wave_observation_candidate(
  p_session_id uuid,
  p_user_id uuid,
  p_beach_id uuid,
  p_arrival_time timestamptz,
  p_status text,
  p_wave_height_ft numeric,
  p_source_created_by text DEFAULT 'trigger'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate_id uuid;
  observed_height_m numeric;
  rejection_reason_text text := NULL;
  nearest_prediction public.ml_predictions_log%rowtype;
  nearest_delta_minutes numeric;
  normalized_source_created_by text;
  session_height_source text;
  session_size_vs_forecast text;
  session_shown_height_ft numeric;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT s.wave_height_source, s.wave_size_vs_forecast, s.forecast_wave_height_ft
  INTO session_height_source, session_size_vs_forecast, session_shown_height_ft
  FROM public.sessions s
  WHERE s.id = p_session_id;

  normalized_source_created_by := CASE
    WHEN p_source_created_by = 'backfill' THEN 'backfill'
    ELSE 'trigger'
  END;

  IF p_status IS DISTINCT FROM 'completed' THEN
    rejection_reason_text := 'session_not_completed';
  ELSIF p_beach_id IS NULL THEN
    rejection_reason_text := 'missing_beach_id';
  ELSIF p_arrival_time IS NULL THEN
    rejection_reason_text := 'missing_arrival_time';
  ELSIF p_wave_height_ft IS NULL THEN
    rejection_reason_text := 'missing_wave_height_ft';
  ELSIF p_wave_height_ft <= 0 OR p_wave_height_ft > 50 THEN
    rejection_reason_text := 'invalid_wave_height_ft';
  ELSIF session_height_source = 'forecast_prefill'
    AND session_size_vs_forecast IS DISTINCT FROM 'about_right'
  THEN
    -- The surfer accepted the form's forecast estimate without changing it, so
    -- the height is the forecast, not an observation of it. A prefill the surfer
    -- answered 'about_right' is kept: it confirms the shown height.
    rejection_reason_text := 'forecast_prefilled_wave_height';
  END IF;

  IF rejection_reason_text IS NOT NULL THEN
    IF p_status IS DISTINCT FROM 'completed'
      AND NOT EXISTS (
        SELECT 1
        FROM public.session_wave_observation_candidates existing
        WHERE existing.session_id = p_session_id
      )
    THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.session_wave_observation_candidates (
      session_id,
      user_id,
      beach_id,
      observed_at,
      reported_wave_height_ft,
      observed_m,
      ml_prediction_id,
      nearest_prediction_delta_minutes,
      quality_state,
      rejection_reason,
      observation_weight,
      source_created_by,
      matched_prediction_at,
      snapshot_display_height_m,
      snapshot_raw_om_height_m,
      snapshot_v5_shadow_height_m,
      snapshot_buoy_observed_m,
      snapshot_raw_forecast_m,
      snapshot_corrected_forecast_m,
      snapshot_model_version,
      snapshot_v5_model_version,
      snapshot_candidate_model_version,
      snapshot_display_source,
      forecast_horizon_hours,
      reported_size_vs_forecast,
      shown_forecast_height_ft
    ) VALUES (
      p_session_id,
      p_user_id,
      p_beach_id,
      p_arrival_time,
      p_wave_height_ft,
      NULL,
      NULL,
      NULL,
      'rejected',
      rejection_reason_text,
      0,
      normalized_source_created_by,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      session_size_vs_forecast,
      session_shown_height_ft
    )
    ON CONFLICT (session_id) DO UPDATE SET
      user_id = excluded.user_id,
      beach_id = excluded.beach_id,
      observed_at = excluded.observed_at,
      reported_wave_height_ft = excluded.reported_wave_height_ft,
      observed_m = NULL,
      ml_prediction_id = NULL,
      nearest_prediction_delta_minutes = NULL,
      quality_state = 'rejected',
      rejection_reason = excluded.rejection_reason,
      observation_weight = 0,
      matched_prediction_at = NULL,
      snapshot_display_height_m = NULL,
      snapshot_raw_om_height_m = NULL,
      snapshot_v5_shadow_height_m = NULL,
      snapshot_buoy_observed_m = NULL,
      snapshot_raw_forecast_m = NULL,
      snapshot_corrected_forecast_m = NULL,
      snapshot_model_version = NULL,
      snapshot_v5_model_version = NULL,
      snapshot_candidate_model_version = NULL,
      snapshot_display_source = NULL,
      forecast_horizon_hours = NULL,
      reported_size_vs_forecast = excluded.reported_size_vs_forecast,
      shown_forecast_height_ft = excluded.shown_forecast_height_ft,
      updated_at = now()
    RETURNING id INTO candidate_id;

    RETURN candidate_id;
  END IF;

  -- A confirmed prefill observes the height the form showed, not the chip it rounded to.
  observed_height_m := round((
    CASE
      WHEN session_height_source = 'forecast_prefill'
        AND session_size_vs_forecast = 'about_right'
        AND session_shown_height_ft > 0
        AND session_shown_height_ft <= 50
      THEN session_shown_height_ft
      ELSE p_wave_height_ft
    END * 0.3048
  )::numeric, 3);

  SELECT p.*
  INTO nearest_prediction
  FROM public.ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.display_source = 'face-Hs-transformer-v1'
    AND p.predicted_at IS NOT NULL
    AND p.predicted_at BETWEEN p_arrival_time - interval '6 hours'
                           AND p_arrival_time + interval '6 hours'
  ORDER BY
    abs(EXTRACT(EPOCH FROM (p.predicted_at - p_arrival_time))) ASC,
    CASE p.forecast_horizon_bucket
      WHEN '0-24h' THEN 1
      WHEN '25-72h' THEN 2
      WHEN '73h+' THEN 3
      ELSE 4
    END ASC,
    p.forecast_horizon_hours ASC NULLS LAST,
    p.created_at DESC
  LIMIT 1;

  IF nearest_prediction.id IS NOT NULL THEN
    nearest_delta_minutes :=
      round((abs(EXTRACT(EPOCH FROM (nearest_prediction.predicted_at - p_arrival_time))) / 60.0)::numeric, 1);
  END IF;

  INSERT INTO public.session_wave_observation_candidates (
    session_id,
    user_id,
    beach_id,
    ml_prediction_id,
    observed_at,
    reported_wave_height_ft,
    observed_m,
    nearest_prediction_delta_minutes,
    quality_state,
    rejection_reason,
    observation_weight,
    source_created_by,
    matched_prediction_at,
    snapshot_display_height_m,
    snapshot_raw_om_height_m,
    snapshot_v5_shadow_height_m,
    snapshot_buoy_observed_m,
    snapshot_raw_forecast_m,
    snapshot_corrected_forecast_m,
    snapshot_model_version,
    snapshot_v5_model_version,
    snapshot_candidate_model_version,
    snapshot_display_source,
    forecast_horizon_hours,
    reported_size_vs_forecast,
    shown_forecast_height_ft
  ) VALUES (
    p_session_id,
    p_user_id,
    p_beach_id,
    nearest_prediction.id,
    p_arrival_time,
    p_wave_height_ft,
    observed_height_m,
    nearest_delta_minutes,
    'weak',
    CASE WHEN nearest_prediction.id IS NULL THEN 'no_matching_prediction' ELSE NULL END,
    0.2,
    normalized_source_created_by,
    nearest_prediction.predicted_at,
    coalesce(nearest_prediction.offset_corrected_display_height_m, nearest_prediction.raw_display_height_m, nearest_prediction.corrected_forecast_m, nearest_prediction.raw_forecast_m, nearest_prediction.wave_height_om),
    nearest_prediction.wave_height_om,
    nearest_prediction.v5_shadow_height_m,
    (
      SELECT g.observed_m
      FROM public.get_prediction_observations(
        p_beach_id,
        nearest_prediction.predicted_at,
        nearest_prediction.predicted_at + interval '1 second'
      ) g
      WHERE g.prediction_id = nearest_prediction.id
    ),
    nearest_prediction.raw_forecast_m,
    nearest_prediction.corrected_forecast_m,
    nearest_prediction.model_version,
    nearest_prediction.v5_model_version,
    nearest_prediction.candidate_model_version,
    nearest_prediction.display_source,
    nearest_prediction.forecast_horizon_hours,
    session_size_vs_forecast,
    session_shown_height_ft
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = excluded.user_id,
    beach_id = excluded.beach_id,
    ml_prediction_id = excluded.ml_prediction_id,
    observed_at = excluded.observed_at,
    reported_wave_height_ft = excluded.reported_wave_height_ft,
    observed_m = excluded.observed_m,
    nearest_prediction_delta_minutes = excluded.nearest_prediction_delta_minutes,
    quality_state = 'weak',
    rejection_reason = excluded.rejection_reason,
    observation_weight = 0.2,
    matched_prediction_at = excluded.matched_prediction_at,
    snapshot_display_height_m = excluded.snapshot_display_height_m,
    snapshot_raw_om_height_m = excluded.snapshot_raw_om_height_m,
    snapshot_v5_shadow_height_m = excluded.snapshot_v5_shadow_height_m,
    snapshot_buoy_observed_m = excluded.snapshot_buoy_observed_m,
    snapshot_raw_forecast_m = excluded.snapshot_raw_forecast_m,
    snapshot_corrected_forecast_m = excluded.snapshot_corrected_forecast_m,
    snapshot_model_version = excluded.snapshot_model_version,
    snapshot_v5_model_version = excluded.snapshot_v5_model_version,
    snapshot_candidate_model_version = excluded.snapshot_candidate_model_version,
    snapshot_display_source = excluded.snapshot_display_source,
    forecast_horizon_hours = excluded.forecast_horizon_hours,
    reported_size_vs_forecast = excluded.reported_size_vs_forecast,
    shown_forecast_height_ft = excluded.shown_forecast_height_ft,
    updated_at = now()
  RETURNING id INTO candidate_id;

  RETURN candidate_id;
END;
$$;

COMMIT;
