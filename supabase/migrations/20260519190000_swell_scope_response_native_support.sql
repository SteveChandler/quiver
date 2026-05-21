BEGIN;

ALTER TABLE public.custom_spots
  ADD COLUMN IF NOT EXISTS facing_direction_deg numeric,
  ADD COLUMN IF NOT EXISTS swell_window_min_deg numeric,
  ADD COLUMN IF NOT EXISTS swell_window_max_deg numeric,
  ADD COLUMN IF NOT EXISTS offshore_direction_deg numeric,
  ADD COLUMN IF NOT EXISTS exposure_level text,
  ADD COLUMN IF NOT EXISTS fingerprint_confidence text,
  ADD COLUMN IF NOT EXISTS fingerprint_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_spots_facing_direction_deg_range'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_facing_direction_deg_range
      CHECK (facing_direction_deg IS NULL OR (facing_direction_deg >= 0 AND facing_direction_deg < 360));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_spots_swell_window_min_deg_range'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_swell_window_min_deg_range
      CHECK (swell_window_min_deg IS NULL OR (swell_window_min_deg >= 0 AND swell_window_min_deg < 360));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_spots_swell_window_max_deg_range'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_swell_window_max_deg_range
      CHECK (swell_window_max_deg IS NULL OR (swell_window_max_deg >= 0 AND swell_window_max_deg < 360));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_spots_offshore_direction_deg_range'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_offshore_direction_deg_range
      CHECK (offshore_direction_deg IS NULL OR (offshore_direction_deg >= 0 AND offshore_direction_deg < 360));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_spots_exposure_level_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_exposure_level_check
      CHECK (
        exposure_level IS NULL
        OR exposure_level IN ('sheltered', 'mixed', 'exposed')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'custom_spots_fingerprint_confidence_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_fingerprint_confidence_check
      CHECK (
        fingerprint_confidence IS NULL
        OR fingerprint_confidence IN ('unset', 'user_set', 'calibrating', 'modeled')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.custom_spots.facing_direction_deg IS
  'User-set break-facing direction in degrees. Null means local rules are unset.';
COMMENT ON COLUMN public.custom_spots.swell_window_min_deg IS
  'User-set lower bound of useful incoming swell window in degrees.';
COMMENT ON COLUMN public.custom_spots.swell_window_max_deg IS
  'User-set upper bound of useful incoming swell window in degrees.';
COMMENT ON COLUMN public.custom_spots.offshore_direction_deg IS
  'User-set offshore wind direction in degrees.';
COMMENT ON COLUMN public.custom_spots.exposure_level IS
  'User-set custom spot exposure: sheltered, mixed, or exposed.';
COMMENT ON COLUMN public.custom_spots.fingerprint_confidence IS
  'Fingerprint state for custom spots: unset, user_set, calibrating, modeled.';

DROP FUNCTION IF EXISTS public.create_custom_spot_guarded(text, double precision, double precision, text, text);

CREATE OR REPLACE FUNCTION public.create_custom_spot_guarded(
  p_name text,
  p_lat double precision,
  p_lon double precision,
  p_break_type text DEFAULT NULL,
  p_visibility text DEFAULT 'private',
  p_facing_direction_deg numeric DEFAULT NULL,
  p_swell_window_min_deg numeric DEFAULT NULL,
  p_swell_window_max_deg numeric DEFAULT NULL,
  p_offshore_direction_deg numeric DEFAULT NULL,
  p_exposure_level text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  lat numeric,
  lon numeric,
  break_type text,
  visibility text,
  nearest_beach_id uuid,
  nearest_beach_distance_mi numeric,
  deleted_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  facing_direction_deg numeric,
  swell_window_min_deg numeric,
  swell_window_max_deg numeric,
  offshore_direction_deg numeric,
  exposure_level text,
  fingerprint_confidence text,
  fingerprint_updated_at timestamptz,
  favorite_id uuid,
  favorite_rank integer
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  trimmed_name text := btrim(p_name);
  nearest_id uuid;
  nearest_distance_miles numeric(5,2);
  favorite_count integer;
  next_rank integer;
  has_unlimited_favorites boolean;
  inserted_spot public.custom_spots%ROWTYPE;
  has_fingerprint boolean := (
    p_facing_direction_deg IS NOT NULL
    OR p_swell_window_min_deg IS NOT NULL
    OR p_swell_window_max_deg IS NOT NULL
    OR p_offshore_direction_deg IS NOT NULL
    OR p_exposure_level IS NOT NULL
  );
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF trimmed_name IS NULL OR char_length(trimmed_name) < 1 OR char_length(trimmed_name) > 60 THEN
    RAISE EXCEPTION 'invalid_custom_spot_name'
      USING DETAIL = 'name_length_1_60_required';
  END IF;

  IF p_lat IS NULL OR p_lon IS NULL
     OR p_lat < -90 OR p_lat > 90
     OR p_lon < -180 OR p_lon > 180 THEN
    RAISE EXCEPTION 'invalid_custom_spot_coordinates'
      USING DETAIL = 'lat_lon_out_of_range';
  END IF;

  IF p_break_type IS NOT NULL
     AND p_break_type <> ALL (ARRAY['reef','point','beach','rivermouth','jetty']) THEN
    RAISE EXCEPTION 'invalid_custom_spot_break_type'
      USING DETAIL = 'unsupported_break_type';
  END IF;

  IF p_exposure_level IS NOT NULL
     AND p_exposure_level <> ALL (ARRAY['sheltered','mixed','exposed']) THEN
    RAISE EXCEPTION 'invalid_custom_spot_exposure'
      USING DETAIL = 'unsupported_exposure_level';
  END IF;

  IF p_facing_direction_deg IS NOT NULL
     AND (p_facing_direction_deg < 0 OR p_facing_direction_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_facing_direction'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  IF p_swell_window_min_deg IS NOT NULL
     AND (p_swell_window_min_deg < 0 OR p_swell_window_min_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_swell_min'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  IF p_swell_window_max_deg IS NOT NULL
     AND (p_swell_window_max_deg < 0 OR p_swell_window_max_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_swell_max'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  IF p_offshore_direction_deg IS NOT NULL
     AND (p_offshore_direction_deg < 0 OR p_offshore_direction_deg >= 360) THEN
    RAISE EXCEPTION 'invalid_custom_spot_offshore_direction'
      USING DETAIL = 'degree_out_of_range';
  END IF;

  nearest_id := public.find_nearest_beach_id(
    p_lat::decimal,
    p_lon::decimal,
    241401.6
  );

  IF nearest_id IS NULL THEN
    RAISE EXCEPTION 'custom_spot_out_of_coverage'
      USING DETAIL = 'nearest_beach_required';
  END IF;

  SELECT round((ST_Distance(
    b.geog,
    ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
  ) / 1609.344)::numeric, 2)::numeric(5,2)
  INTO nearest_distance_miles
  FROM public.beaches b
  WHERE b.id = nearest_id;

  IF nearest_distance_miles IS NULL THEN
    RAISE EXCEPTION 'custom_spot_out_of_coverage'
      USING DETAIL = 'nearest_beach_distance_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);

  SELECT EXISTS (
    SELECT 1
    FROM public.user_entitlements ue
    WHERE ue.user_id = current_user_id
      AND (ue.is_pro = true OR ue.is_trialing = true)
      AND (
        ue.expires_at IS NULL
        OR ue.expires_at > now()
        OR ue.billing_issue = true
      )
  ) INTO has_unlimited_favorites;

  SELECT count(*) INTO favorite_count
  FROM public.favorite_beaches fb
  WHERE fb.user_id = current_user_id;

  IF NOT has_unlimited_favorites AND favorite_count >= 3 THEN
    RAISE EXCEPTION 'favorite_quota_exceeded'
      USING DETAIL = 'free_favorites_limit';
  END IF;

  SELECT COALESCE(max(fb.rank), 0) + 1 INTO next_rank
  FROM public.favorite_beaches fb
  WHERE fb.user_id = current_user_id;

  INSERT INTO public.custom_spots (
    user_id,
    name,
    lat,
    lon,
    break_type,
    visibility,
    nearest_beach_id,
    nearest_beach_distance_mi,
    facing_direction_deg,
    swell_window_min_deg,
    swell_window_max_deg,
    offshore_direction_deg,
    exposure_level,
    fingerprint_confidence,
    fingerprint_updated_at
  )
  VALUES (
    current_user_id,
    trimmed_name,
    p_lat,
    p_lon,
    p_break_type,
    'private',
    nearest_id,
    nearest_distance_miles,
    p_facing_direction_deg,
    p_swell_window_min_deg,
    p_swell_window_max_deg,
    p_offshore_direction_deg,
    p_exposure_level,
    CASE WHEN has_fingerprint THEN 'user_set' ELSE 'unset' END,
    CASE WHEN has_fingerprint THEN now() ELSE NULL END
  )
  RETURNING * INTO inserted_spot;

  INSERT INTO public.favorite_beaches (
    user_id,
    beach_id,
    custom_spot_id,
    rank,
    alerts_enabled
  )
  VALUES (
    current_user_id,
    NULL,
    inserted_spot.id,
    next_rank,
    false
  )
  RETURNING favorite_beaches.id, favorite_beaches.rank
  INTO favorite_id, favorite_rank;

  id := inserted_spot.id;
  user_id := inserted_spot.user_id;
  name := inserted_spot.name;
  lat := inserted_spot.lat;
  lon := inserted_spot.lon;
  break_type := inserted_spot.break_type;
  visibility := inserted_spot.visibility;
  nearest_beach_id := inserted_spot.nearest_beach_id;
  nearest_beach_distance_mi := inserted_spot.nearest_beach_distance_mi;
  deleted_at := inserted_spot.deleted_at;
  created_at := inserted_spot.created_at;
  updated_at := inserted_spot.updated_at;
  facing_direction_deg := inserted_spot.facing_direction_deg;
  swell_window_min_deg := inserted_spot.swell_window_min_deg;
  swell_window_max_deg := inserted_spot.swell_window_max_deg;
  offshore_direction_deg := inserted_spot.offshore_direction_deg;
  exposure_level := inserted_spot.exposure_level;
  fingerprint_confidence := inserted_spot.fingerprint_confidence;
  fingerprint_updated_at := inserted_spot.fingerprint_updated_at;

  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_custom_spot_fingerprint(
  p_spot_id uuid,
  p_facing_direction_deg numeric DEFAULT NULL,
  p_swell_window_min_deg numeric DEFAULT NULL,
  p_swell_window_max_deg numeric DEFAULT NULL,
  p_offshore_direction_deg numeric DEFAULT NULL,
  p_exposure_level text DEFAULT NULL
)
RETURNS public.custom_spots
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  updated_spot public.custom_spots%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_exposure_level IS NOT NULL
     AND p_exposure_level <> ALL (ARRAY['sheltered','mixed','exposed']) THEN
    RAISE EXCEPTION 'invalid_custom_spot_exposure'
      USING DETAIL = 'unsupported_exposure_level';
  END IF;

  UPDATE public.custom_spots
  SET
    facing_direction_deg = p_facing_direction_deg,
    swell_window_min_deg = p_swell_window_min_deg,
    swell_window_max_deg = p_swell_window_max_deg,
    offshore_direction_deg = p_offshore_direction_deg,
    exposure_level = p_exposure_level,
    fingerprint_confidence = CASE
      WHEN p_facing_direction_deg IS NULL
        AND p_swell_window_min_deg IS NULL
        AND p_swell_window_max_deg IS NULL
        AND p_offshore_direction_deg IS NULL
        AND p_exposure_level IS NULL
      THEN 'unset'
      ELSE 'user_set'
    END,
    fingerprint_updated_at = now()
  WHERE id = p_spot_id
    AND user_id = auth.uid()
    AND deleted_at IS NULL
  RETURNING * INTO updated_spot;

  IF updated_spot.id IS NULL THEN
    RAISE EXCEPTION 'custom_spot_not_found';
  END IF;

  RETURN updated_spot;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_board_deck_stats(p_user_id uuid)
RETURNS TABLE (
  board_id uuid,
  sessions_count integer,
  positive_sessions_count integer,
  best_period_range text,
  best_wind_label text,
  learned_label text,
  last_used_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only query own board stats';
  END IF;

  RETURN QUERY
  WITH board_base AS (
    SELECT b.id AS board_id
    FROM public.boards b
    WHERE b.user_id = p_user_id
  ),
  session_base AS (
    SELECT
      s.board_id,
      s.id AS session_id,
      s.rating,
      s.arrival_time,
      s.custom_spot_id,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS wave_period_s,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind_speed_mph,
      public.parse_numeric_from_text(COALESCE(
        sfs.forecast_snapshot->>'wind_direction_deg',
        sfs.forecast_snapshot->>'wind_direction'
      )) AS wind_direction_deg
    FROM public.sessions s
    LEFT JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    WHERE s.user_id = p_user_id
      AND s.board_id IS NOT NULL
      AND s.status = 'completed'
      AND s.deleted_at IS NULL
  ),
  positive AS (
    SELECT *
    FROM session_base
    WHERE rating >= 4
  ),
  aggregate_stats AS (
    SELECT
      bb.board_id,
      COUNT(sb.session_id)::integer AS sessions_count,
      COUNT(p.session_id)::integer AS positive_sessions_count,
      MAX(sb.arrival_time) AS last_used_at,
      percentile_cont(0.25) WITHIN GROUP (ORDER BY p.wave_period_s)
        FILTER (WHERE p.wave_period_s IS NOT NULL) AS p25_period,
      percentile_cont(0.75) WITHIN GROUP (ORDER BY p.wave_period_s)
        FILTER (WHERE p.wave_period_s IS NOT NULL) AS p75_period,
      AVG(p.wind_speed_mph) FILTER (WHERE p.wind_speed_mph IS NOT NULL) AS avg_wind_speed,
      AVG(
        CASE
          WHEN cs.offshore_direction_deg IS NULL OR p.wind_direction_deg IS NULL THEN NULL
          ELSE LEAST(
            ABS(cs.offshore_direction_deg - p.wind_direction_deg),
            360 - ABS(cs.offshore_direction_deg - p.wind_direction_deg)
          )
        END
      ) FILTER (WHERE cs.offshore_direction_deg IS NOT NULL AND p.wind_direction_deg IS NOT NULL) AS avg_offshore_delta
    FROM board_base bb
    LEFT JOIN session_base sb ON sb.board_id = bb.board_id
    LEFT JOIN positive p ON p.board_id = bb.board_id
    LEFT JOIN public.custom_spots cs ON cs.id = p.custom_spot_id
    GROUP BY bb.board_id
  )
  SELECT
    a.board_id,
    COALESCE(a.sessions_count, 0),
    COALESCE(a.positive_sessions_count, 0),
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 OR a.p25_period IS NULL OR a.p75_period IS NULL THEN NULL
      ELSE format('Best: %s-%ss', round(a.p25_period)::integer, round(a.p75_period)::integer)
    END AS best_period_range,
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 THEN NULL
      WHEN a.avg_offshore_delta IS NOT NULL AND a.avg_offshore_delta <= 45 THEN 'Light offshore'
      WHEN a.avg_offshore_delta IS NOT NULL AND a.avg_offshore_delta <= 75 THEN 'Clean side-off'
      WHEN a.avg_wind_speed IS NULL THEN NULL
      WHEN a.avg_wind_speed <= 7 THEN 'Light wind'
      WHEN a.avg_wind_speed <= 12 THEN 'Handles texture'
      ELSE 'Wind tolerant'
    END AS best_wind_label,
    CASE
      WHEN COALESCE(a.positive_sessions_count, 0) < 3 THEN 'Learning this board'
      ELSE 'Learned from sessions'
    END AS learned_label,
    a.last_used_at
  FROM aggregate_stats a;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_session_match_comparison(
  p_user_id uuid,
  p_beach_id uuid,
  p_wave_height text,
  p_wave_period text,
  p_wind_speed text,
  p_wind_direction text,
  p_tide_height text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_count integer;
  v_future_wave numeric := public.parse_numeric_from_text(p_wave_height);
  v_future_period numeric := public.parse_numeric_from_text(p_wave_period);
  v_future_wind numeric := public.parse_numeric_from_text(p_wind_speed);
  v_future_wind_dir numeric := public.parse_numeric_from_text(p_wind_direction);
  v_future_tide numeric := public.parse_numeric_from_text(p_tide_height);
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
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') AS wave_height,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS wave_period,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind_speed,
      public.parse_numeric_from_text(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) AS wind_direction,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') AS tide_height,
      (
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') - v_future_wave), 99) * 0.35 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') - v_future_period), 99) * 0.20 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') - v_future_wind), 99) * 0.15 +
        COALESCE(LEAST(
          ABS(public.parse_numeric_from_text(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) - v_future_wind_dir),
          360 - ABS(public.parse_numeric_from_text(COALESCE(sfs.forecast_snapshot->>'wind_direction_deg', sfs.forecast_snapshot->>'wind_direction')) - v_future_wind_dir)
        ) / 30, 99) * 0.15 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') - v_future_tide), 99) * 0.15
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
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') AS wave_height,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS wave_period,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS wind_speed,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') AS tide_height,
      (
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') - v_future_wave), 99) * 0.35 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') - v_future_period), 99) * 0.25 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') - v_future_wind), 99) * 0.20 +
        COALESCE(ABS(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') - v_future_tide), 99) * 0.20
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
$$;

GRANT EXECUTE ON FUNCTION public.create_custom_spot_guarded(
  text,
  double precision,
  double precision,
  text,
  text,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_custom_spot_fingerprint(
  uuid,
  numeric,
  numeric,
  numeric,
  numeric,
  text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_board_deck_stats(uuid)
  TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_user_session_match_comparison(
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text
) TO authenticated;

COMMIT;
