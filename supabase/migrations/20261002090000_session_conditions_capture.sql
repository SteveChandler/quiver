-- Session conditions capture (docs/superpowers/plans/2026-10-01-session-conditions-capture.md).
-- 1. Typed, provenance-tagged condition and CDIP MOP nearshore columns on sessions; MOP mapping on beaches.
-- 2. A tide chip keeps the user's status and still gets the computed height (it used to drop it).
-- 3. compute_session_tide_snapshot reads one tide series, as selectTideSeries does.
-- 4. Backfill: sessions logged with only a chip get their height.
BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN swell_period_s numeric(4,1),
  ADD COLUMN swell_direction_deg smallint,
  ADD COLUMN swell_height_ft numeric(4,1),
  -- Open-Meteo primary swell partition, stored raw: in the 2026-10-01 backtest its period was the
  -- only close-out predictor that held, and the display rule often shows CDIP's instead.
  ADD COLUMN offshore_swell_period_s numeric(4,1),
  ADD COLUMN offshore_swell_direction_deg smallint,
  ADD COLUMN offshore_swell_height_ft numeric(4,1),
  ADD COLUMN wind_direction_deg smallint,
  ADD COLUMN conditions_forecast_at timestamptz,
  ADD COLUMN conditions_source text,
  ADD COLUMN tide_status_user_set boolean NOT NULL DEFAULT false,
  ADD COLUMN nearshore_point_id text,
  ADD COLUMN nearshore_observed_at timestamptz,
  ADD COLUMN nearshore_hs_m numeric(4,2),
  ADD COLUMN nearshore_tp_s numeric(4,1),
  ADD COLUMN nearshore_dp_deg smallint,
  ADD COLUMN nearshore_dm_deg smallint,
  -- Swell-band (0.04–0.10 Hz) mean period: MOP's peak Tp is often the local wind sea (7 s at La Jolla Shores 9/30).
  ADD COLUMN nearshore_swellband_tm_s numeric(4,1),
  -- Hs at the point ÷ mean Hs of the ±2 neighbouring MOP points: canyon focusing (LJS 9/30 = 1.53, 93rd pct).
  ADD COLUMN nearshore_focus_ratio numeric(4,2),
  ADD COLUMN nearshore_source text;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_swell_direction_deg_check CHECK (swell_direction_deg IS NULL OR swell_direction_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_offshore_swell_direction_deg_check CHECK (offshore_swell_direction_deg IS NULL OR offshore_swell_direction_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_wind_direction_deg_check CHECK (wind_direction_deg IS NULL OR wind_direction_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_nearshore_dp_deg_check CHECK (nearshore_dp_deg IS NULL OR nearshore_dp_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_nearshore_dm_deg_check CHECK (nearshore_dm_deg IS NULL OR nearshore_dm_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_conditions_source_check CHECK (conditions_source IS NULL OR conditions_source IN ('client', 'forecast_row', 'snapshot_backfill', 'none')),
  ADD CONSTRAINT sessions_nearshore_source_check CHECK (nearshore_source IS NULL OR nearshore_source IN ('cdip_mop_nowcast', 'cdip_mop_backfill', 'unavailable', 'unmapped'));

-- The enrich cron selects sessions still missing conditions; keep that scan cheap.
CREATE INDEX sessions_conditions_pending_idx
  ON public.sessions (arrival_time)
  WHERE deleted_at IS NULL AND (conditions_source IS NULL OR nearshore_source IS NULL);

ALTER TABLE public.beaches
  ADD COLUMN mop_point_id text,
  ADD COLUMN mop_shore_normal_deg smallint,
  ADD COLUMN mop_point_distance_m integer;

ALTER TABLE public.beaches
  ADD CONSTRAINT beaches_mop_shore_normal_deg_check CHECK (mop_shore_normal_deg IS NULL OR mop_shore_normal_deg BETWEEN 0 AND 359);

-- tide_forecasts can hold several series for one hour: noaa and noaa_hilo_interpolated, and an old
-- station's rows after the refresh cron re-resolves the nearest station. Interpolating across them puts
-- a fake turning point between rows. Read one series the way lib/services/tide-forecast-selection.ts
-- selectTideSeries does: the latest ingestion's station, one row per UTC hour, noaa over hilo.
CREATE OR REPLACE FUNCTION public.compute_session_tide_snapshot(p_beach_id uuid, p_arrival_time timestamp with time zone)
 RETURNS TABLE(tide_height_ft numeric, tide_status text, tide_rate_ft_per_hr numeric, tide_data_source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH window_rows AS (
    SELECT tf.ts, COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) AS height_m, tf.source, tf.station_id, tf.created_at,
      CASE tf.source WHEN 'noaa' THEN 2 WHEN 'noaa_hilo_interpolated' THEN 1 ELSE 0 END AS source_rank
    FROM public.tide_forecasts tf
    WHERE tf.beach_id = p_beach_id
      AND tf.ts >= p_arrival_time - INTERVAL '4 hours' AND tf.ts <= p_arrival_time + INTERVAL '4 hours'
      AND COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) IS NOT NULL
  ),
  latest_station AS (
    SELECT wr.station_id
    FROM window_rows wr
    ORDER BY wr.created_at DESC NULLS LAST, wr.source_rank DESC, wr.station_id DESC NULLS LAST
    LIMIT 1
  ),
  series AS (
    SELECT DISTINCT ON (date_trunc('hour', wr.ts AT TIME ZONE 'UTC')) wr.ts, wr.height_m, wr.source AS source_name
    FROM window_rows wr
    JOIN latest_station ls ON wr.station_id IS NOT DISTINCT FROM ls.station_id
    ORDER BY date_trunc('hour', wr.ts AT TIME ZONE 'UTC'), wr.source_rank DESC, wr.created_at DESC NULLS LAST,
      abs(EXTRACT(EPOCH FROM (wr.ts AT TIME ZONE 'UTC' - date_trunc('hour', wr.ts AT TIME ZONE 'UTC')))) ASC, wr.ts DESC
  ),
  previous_point AS (
    SELECT s.ts, s.height_m, s.source_name FROM series s WHERE s.ts <= p_arrival_time ORDER BY s.ts DESC LIMIT 1
  ),
  next_point AS (
    SELECT s.ts, s.height_m, s.source_name FROM series s WHERE s.ts > p_arrival_time ORDER BY s.ts ASC LIMIT 1
  ),
  before_previous AS (
    SELECT s.ts, s.height_m FROM series s CROSS JOIN previous_point pp WHERE s.ts < pp.ts ORDER BY s.ts DESC LIMIT 1
  ),
  after_next AS (
    SELECT s.ts, s.height_m FROM series s CROSS JOIN next_point np WHERE s.ts > np.ts ORDER BY s.ts ASC LIMIT 1
  ),
  calculated AS (
    SELECT pp.ts AS previous_ts, np.ts AS next_ts, pp.height_m AS previous_height_m, np.height_m AS next_height_m,
      bp.ts AS before_ts, an.ts AS after_ts, bp.height_m AS before_height_m, an.height_m AS after_height_m,
      pp.source_name AS previous_source, np.source_name AS next_source,
      EXTRACT(EPOCH FROM (np.ts - pp.ts)) / 3600.0 AS span_hours,
      EXTRACT(EPOCH FROM (np.ts - bp.ts)) / 3600.0 AS central_span_hours,
      p_arrival_time = pp.ts AS exact_on_previous,
      GREATEST(0, LEAST(1, EXTRACT(EPOCH FROM (p_arrival_time - pp.ts)) / NULLIF(EXTRACT(EPOCH FROM (np.ts - pp.ts)), 0))) AS interpolation_fraction
    FROM previous_point pp JOIN next_point np ON true LEFT JOIN before_previous bp ON true LEFT JOIN after_next an ON true
  ),
  derived AS (
    SELECT
      (previous_height_m + (next_height_m - previous_height_m) * ((1 - COS(PI() * interpolation_fraction)) / 2)) * 3.28084 AS height_ft,
      CASE
        WHEN exact_on_previous AND before_height_m IS NOT NULL AND central_span_hours > 0
        THEN ((next_height_m - before_height_m) * 3.28084) / central_span_hours
        ELSE ((next_height_m - previous_height_m) * 3.28084) / span_hours
      END AS rate_ft_per_hr,
      (previous_height_m - COALESCE(before_height_m, previous_height_m)) AS slope_before,
      (next_height_m - previous_height_m) AS slope_between,
      (COALESCE(after_height_m, next_height_m) - next_height_m) AS slope_after,
      exact_on_previous, previous_source, next_source
    FROM calculated WHERE span_hours > 0
  )
  SELECT
    ROUND(height_ft::numeric, 2) AS tide_height_ft,
    CASE
      WHEN exact_on_previous AND slope_before > 0 AND slope_between < 0 THEN 'high'
      WHEN exact_on_previous AND slope_before < 0 AND slope_between > 0 THEN 'low'
      WHEN slope_before > 0 AND slope_after < 0 THEN 'high'
      WHEN slope_before < 0 AND slope_after > 0 THEN 'low'
      WHEN rate_ft_per_hr >= 0 THEN 'rising'
      ELSE 'falling'
    END AS tide_status,
    ROUND(rate_ft_per_hr::numeric, 2) AS tide_rate_ft_per_hr,
    CASE
      WHEN previous_source IN ('noaa', 'noaa_hilo_interpolated') OR next_source IN ('noaa', 'noaa_hilo_interpolated') THEN 'noaa'
      WHEN previous_source = 'open-meteo' OR next_source = 'open-meteo' THEN 'open-meteo'
      ELSE 'noaa'
    END AS tide_data_source
  FROM derived;
$function$;

-- A tide chip is a status, not a measurement. Keep the user's status (tide_status_user_set) and still
-- take height, rate and source from the snapshot; only a user-entered height is marked 'user'.
CREATE OR REPLACE FUNCTION public.apply_session_tide_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  snapshot RECORD;
  has_snapshot BOOLEAN := false;
  has_manual_tide BOOLEAN := false;
  status_only_tide BOOLEAN := false;
  cleared_user_status BOOLEAN := false;
  should_recompute_tide BOOLEAN := false;
BEGIN
  IF NEW.beach_id IS NULL OR NEW.arrival_time IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO snapshot FROM public.compute_session_tide_snapshot(NEW.beach_id, NEW.arrival_time) LIMIT 1;
  has_snapshot := FOUND;

  should_recompute_tide :=
    TG_OP = 'UPDATE'
    AND (NEW.beach_id IS DISTINCT FROM OLD.beach_id OR NEW.arrival_time IS DISTINCT FROM OLD.arrival_time)
    AND COALESCE(NEW.tide_data_source, '') <> 'user';

  IF should_recompute_tide THEN
    IF has_snapshot THEN
      NEW.tide_height_ft := snapshot.tide_height_ft;
      IF NOT NEW.tide_status_user_set THEN
        NEW.tide_status := snapshot.tide_status;
      END IF;
      NEW.tide_rate_ft_per_hr := snapshot.tide_rate_ft_per_hr;
      NEW.tide_data_source := snapshot.tide_data_source;
    ELSE
      NEW.tide_height_ft := NULL;
      IF NOT NEW.tide_status_user_set THEN
        NEW.tide_status := NULL;
      END IF;
      NEW.tide_rate_ft_per_hr := NULL;
      NEW.tide_data_source := NULL;
    END IF;
    RETURN NEW;
  END IF;

  cleared_user_status :=
    TG_OP = 'UPDATE'
    AND OLD.tide_status_user_set
    AND OLD.tide_status IS NOT NULL
    AND NEW.tide_status IS NULL
    AND NEW.tide_height_ft IS NOT DISTINCT FROM OLD.tide_height_ft;

  IF cleared_user_status THEN
    NEW.tide_status_user_set := false;
  END IF;

  status_only_tide :=
    NEW.tide_status IS NOT NULL
    AND (
      (TG_OP = 'INSERT' AND NEW.tide_height_ft IS NULL)
      OR (
        TG_OP = 'UPDATE'
        AND NEW.tide_status IS DISTINCT FROM OLD.tide_status
        AND NEW.tide_height_ft IS NOT DISTINCT FROM OLD.tide_height_ft
        AND (OLD.tide_height_ft IS NULL OR COALESCE(OLD.tide_data_source, '') <> 'user')
      )
    );

  IF status_only_tide THEN
    NEW.tide_status_user_set := true;
    IF has_snapshot THEN
      NEW.tide_height_ft := snapshot.tide_height_ft;
      NEW.tide_rate_ft_per_hr := snapshot.tide_rate_ft_per_hr;
      NEW.tide_data_source := snapshot.tide_data_source;
    ELSE
      NEW.tide_height_ft := NULL;
      NEW.tide_rate_ft_per_hr := NULL;
      NEW.tide_data_source := NULL;
    END IF;
    RETURN NEW;
  END IF;

  has_manual_tide :=
    NOT cleared_user_status
    AND (
      COALESCE(NEW.tide_data_source, '') = 'user'
      OR (TG_OP = 'INSERT' AND (NEW.tide_height_ft IS NOT NULL OR NEW.tide_status IS NOT NULL))
      OR (
        TG_OP = 'UPDATE'
        AND (NEW.tide_height_ft IS DISTINCT FROM OLD.tide_height_ft OR NEW.tide_status IS DISTINCT FROM OLD.tide_status)
        AND (NEW.tide_height_ft IS NOT NULL OR NEW.tide_status IS NOT NULL)
      )
    );

  IF has_manual_tide THEN
    NEW.tide_data_source := 'user';
    IF NEW.tide_rate_ft_per_hr IS NULL AND has_snapshot THEN
      NEW.tide_rate_ft_per_hr := snapshot.tide_rate_ft_per_hr;
    END IF;
    RETURN NEW;
  END IF;

  IF has_snapshot THEN
    NEW.tide_height_ft := snapshot.tide_height_ft;
    IF NOT NEW.tide_status_user_set THEN
      NEW.tide_status := snapshot.tide_status;
    END IF;
    NEW.tide_rate_ft_per_hr := snapshot.tide_rate_ft_per_hr;
    NEW.tide_data_source := snapshot.tide_data_source;
  END IF;

  RETURN NEW;
END;
$function$;

-- Backfill: chip-only sessions were stored as tide_data_source='user' with no height. Flag the status as
-- the user's and clear the false 'user' source; the trigger above then fills height, rate and source.
UPDATE public.sessions
SET tide_status_user_set = true,
    tide_data_source = NULL
WHERE tide_data_source = 'user'
  AND tide_height_ft IS NULL
  AND tide_status IS NOT NULL;

COMMIT;
