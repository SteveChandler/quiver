-- Minimal schema for the session conditions SQL tests: the columns the tide trigger and the
-- 20261002090000 migration touch, plus the production tide functions as of 2026-10-01
-- (copied from pg_get_functiondef on prod, unchanged).
-- auth.users stands in for Supabase's table: update_beach_affinity_trigger's FK makes any UPDATE of a
-- session whose user has no auth row fail, so the migration's backfill must skip those.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
INSERT INTO auth.users (id) VALUES ('cccccccc-0000-4000-8000-000000000001');

CREATE TABLE public.beaches (
  id uuid PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE public.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  beach_id uuid REFERENCES public.beaches(id),
  arrival_time timestamptz,
  deleted_at timestamptz,
  tide_height_ft numeric,
  tide_status text,
  tide_rate_ft_per_hr numeric(4,2),
  tide_data_source text,
  wind_speed_mph integer,
  wind_direction text,
  CONSTRAINT sessions_tide_data_source_check CHECK (tide_data_source IS NULL OR tide_data_source IN ('noaa', 'open-meteo', 'user'))
);

CREATE TABLE public.tide_forecasts (
  beach_id uuid,
  ts timestamptz NOT NULL,
  tide_ft real,
  tide_height_m real,
  source text,
  station_id text,
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.compute_session_tide_snapshot(p_beach_id uuid, p_arrival_time timestamp with time zone)
 RETURNS TABLE(tide_height_ft numeric, tide_status text, tide_rate_ft_per_hr numeric, tide_data_source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH previous_point AS (
    SELECT tf.ts, COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) AS height_m, tf.source AS source_name
    FROM public.tide_forecasts tf
    WHERE tf.beach_id = p_beach_id AND tf.ts <= p_arrival_time AND tf.ts >= p_arrival_time - INTERVAL '4 hours'
      AND COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) IS NOT NULL
    ORDER BY tf.ts DESC LIMIT 1
  ),
  next_point AS (
    SELECT tf.ts, COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) AS height_m, tf.source AS source_name
    FROM public.tide_forecasts tf
    WHERE tf.beach_id = p_beach_id AND tf.ts > p_arrival_time AND tf.ts <= p_arrival_time + INTERVAL '4 hours'
      AND COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) IS NOT NULL
    ORDER BY tf.ts ASC LIMIT 1
  ),
  before_previous AS (
    SELECT tf.ts, COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) AS height_m
    FROM public.tide_forecasts tf CROSS JOIN previous_point pp
    WHERE tf.beach_id = p_beach_id AND tf.ts < pp.ts AND tf.ts >= p_arrival_time - INTERVAL '4 hours'
      AND COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) IS NOT NULL
    ORDER BY tf.ts DESC LIMIT 1
  ),
  after_next AS (
    SELECT tf.ts, COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) AS height_m
    FROM public.tide_forecasts tf CROSS JOIN next_point np
    WHERE tf.beach_id = p_beach_id AND tf.ts > np.ts AND tf.ts <= p_arrival_time + INTERVAL '4 hours'
      AND COALESCE(tf.tide_height_m, tf.tide_ft / 3.28084) IS NOT NULL
    ORDER BY tf.ts ASC LIMIT 1
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
      NEW.tide_status := snapshot.tide_status;
      NEW.tide_rate_ft_per_hr := snapshot.tide_rate_ft_per_hr;
      NEW.tide_data_source := snapshot.tide_data_source;
    ELSE
      NEW.tide_height_ft := NULL;
      NEW.tide_status := NULL;
      NEW.tide_rate_ft_per_hr := NULL;
      NEW.tide_data_source := NULL;
    END IF;
    RETURN NEW;
  END IF;

  has_manual_tide :=
    COALESCE(NEW.tide_data_source, '') = 'user'
    OR (TG_OP = 'INSERT' AND (NEW.tide_height_ft IS NOT NULL OR NEW.tide_status IS NOT NULL))
    OR (
      TG_OP = 'UPDATE'
      AND (NEW.tide_height_ft IS DISTINCT FROM OLD.tide_height_ft OR NEW.tide_status IS DISTINCT FROM OLD.tide_status)
      AND (NEW.tide_height_ft IS NOT NULL OR NEW.tide_status IS NOT NULL)
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
    NEW.tide_status := snapshot.tide_status;
    NEW.tide_rate_ft_per_hr := snapshot.tide_rate_ft_per_hr;
    NEW.tide_data_source := snapshot.tide_data_source;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trigger_apply_session_tide_snapshot
  BEFORE INSERT OR UPDATE OF beach_id, arrival_time, tide_height_ft, tide_status, tide_rate_ft_per_hr, tide_data_source
  ON public.sessions FOR EACH ROW EXECUTE FUNCTION apply_session_tide_snapshot();

-- Fixture data: one beach with an hourly tide series around 2026-09-30 15:00Z.
INSERT INTO public.beaches (id, name) VALUES ('aaaaaaaa-0000-4000-8000-000000000001', 'Fixture Beach');
-- Station S1 (current, written 2026-09-29): noaa rows every hour 12–18Z rising 2.5 → 5.3 ft,
-- plus a noaa_hilo_interpolated row at 15Z that disagrees (3.9 ft) — selection must prefer noaa (3.38).
INSERT INTO public.tide_forecasts (beach_id, ts, tide_ft, source, station_id, created_at) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T12:00:00Z', 2.53, 'noaa', 'S1', '2026-09-29T04:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T13:00:00Z', 2.56, 'noaa', 'S1', '2026-09-29T04:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T14:00:00Z', 2.84, 'noaa', 'S1', '2026-09-29T04:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:00:00Z', 3.90, 'noaa_hilo_interpolated', 'S1', '2026-09-29T04:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:00:00Z', 3.38, 'noaa', 'S1', '2026-09-29T04:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T16:00:00Z', 4.09, 'noaa', 'S1', '2026-09-29T04:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T17:00:00Z', 4.83, 'noaa', 'S1', '2026-09-29T04:00:00Z'),
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T18:00:00Z', 5.30, 'noaa', 'S1', '2026-09-29T04:00:00Z'),
  -- An old station's leftover row at 15Z (written earlier) must be ignored.
  ('aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:00:00Z', 9.90, 'noaa', 'OLD', '2026-08-01T04:00:00Z');

-- A session logged before the migration with only a tide chip: the old trigger marks it 'user'
-- and drops the height. The migration's backfill must give it one.
INSERT INTO public.sessions (id, user_id, beach_id, arrival_time, tide_status) VALUES
  ('bbbbbbbb-0000-4000-8000-000000000099', 'cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z', 'high'),
  -- Same shape, but its user has no auth row (a mock profile): the backfill must leave it alone.
  ('bbbbbbbb-0000-4000-8000-000000000098', 'cccccccc-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000001', '2026-09-30T15:30:00Z', 'high');
DO $$ BEGIN
  ASSERT (SELECT tide_data_source = 'user' AND tide_height_ft IS NULL FROM public.sessions
          WHERE id = 'bbbbbbbb-0000-4000-8000-000000000099'), 'fixture: old trigger should drop the height';
END $$;
