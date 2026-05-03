BEGIN;

CREATE OR REPLACE FUNCTION public.compute_user_match_score(p_user_id uuid, p_beach_id uuid, p_wave_height text, p_wave_period text, p_wind_speed text, p_wind_direction text, p_tide_height text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_session_count integer;
  v_forecast_wave numeric;
  v_forecast_period numeric;
  v_forecast_wind numeric;
  v_forecast_wind_dir numeric;
  v_forecast_tide numeric;

  v_pref_wave numeric;
  v_pref_period numeric;
  v_pref_wind numeric;
  v_pref_wind_dir numeric;
  v_pref_tide numeric;
  v_pref_count integer;

  v_av_wave numeric;
  v_av_period numeric;
  v_av_wind numeric;
  v_av_wind_dir numeric;
  v_av_tide numeric;
  v_av_count integer;

  v_wave_distance numeric;
  v_period_distance numeric;
  v_wind_distance numeric;
  v_wind_dir_distance numeric;
  v_tide_distance numeric;

  v_av_wave_distance numeric;
  v_av_period_distance numeric;
  v_av_wind_distance numeric;
  v_av_wind_dir_distance numeric;
  v_av_tide_distance numeric;

  v_base_distance numeric;
  v_base_score numeric;
  v_aversion_distance numeric;
  v_aversion_proximity numeric;
  v_aversion_penalty numeric;
  v_score numeric;
  v_label text;
  v_confidence text;
  v_reason_bullets jsonb;
  v_board_tip text;
  v_beach_break_type text;

  c_aversion_scaling constant numeric := 3.0;
BEGIN
  SELECT COUNT(*)::integer INTO v_session_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating IS NOT NULL
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL;

  IF v_session_count < 5 THEN
    RETURN jsonb_build_object(
      'state', 'onboarding',
      'session_count', v_session_count,
      'sessions_needed', 5 - v_session_count
    );
  END IF;

  v_forecast_wave     := public.parse_numeric_from_text(p_wave_height);
  v_forecast_period   := public.parse_numeric_from_text(p_wave_period);
  v_forecast_wind     := public.parse_numeric_from_text(p_wind_speed);
  v_forecast_wind_dir := public.parse_numeric_from_text(p_wind_direction);
  v_forecast_tide     := public.parse_numeric_from_text(p_tide_height);

  SELECT break_type INTO v_beach_break_type FROM public.beaches WHERE id = p_beach_id;

  SELECT
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_direction_deg') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') * (s.rating - 3))
      / NULLIF(SUM(s.rating - 3), 0),
    COUNT(*)::integer
  INTO
    v_pref_wave, v_pref_period, v_pref_wind, v_pref_wind_dir, v_pref_tide, v_pref_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  LEFT JOIN public.beaches b ON b.id = s.beach_id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating >= 4
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL
    AND (v_beach_break_type IS NULL OR b.break_type = v_beach_break_type OR b.break_type IS NULL);

  SELECT
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_direction_deg') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') * (3 - s.rating))
      / NULLIF(SUM(3 - s.rating), 0),
    COUNT(*)::integer
  INTO
    v_av_wave, v_av_period, v_av_wind, v_av_wind_dir, v_av_tide, v_av_count
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  LEFT JOIN public.beaches b ON b.id = s.beach_id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating <= 2
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL
    AND (v_beach_break_type IS NULL OR b.break_type = v_beach_break_type OR b.break_type IS NULL);

  IF v_pref_count IS NULL OR v_pref_count = 0 THEN
    IF v_av_count IS NULL OR v_av_count = 0 THEN
      RETURN jsonb_build_object(
        'state', 'ready',
        'score', 5.0,
        'label', 'FAIR',
        'reason_bullets', jsonb_build_array(
          'No strong preferences logged yet — keep rating sessions',
          format('Wave height %s ft — no profile peak', round(v_forecast_wave::numeric, 1)),
          format('Period %s s — no profile peak', round(v_forecast_period::numeric, 0))
        ),
        'board_tip', NULL,
        'confidence', 'low',
        'sessions_in_profile', v_session_count,
        'profile_kind', 'neutral'
      );
    END IF;

    RETURN jsonb_build_object(
      'state', 'onboarding',
      'session_count', v_session_count,
      'sessions_needed', 0,
      'reason', 'no_positive_sessions'
    );
  END IF;

  v_wave_distance     := LEAST(ABS(v_pref_wave - v_forecast_wave) / GREATEST(v_pref_wave, 1), 1);
  v_period_distance   := LEAST(ABS(v_pref_period - v_forecast_period) / GREATEST(v_pref_period, 1), 1);
  v_wind_distance     := LEAST(ABS(v_pref_wind - v_forecast_wind) / GREATEST(v_pref_wind, 5), 1);
  v_tide_distance     := LEAST(ABS(v_pref_tide - v_forecast_tide) / 3, 1);
  v_wind_dir_distance := LEAST(
    LEAST(ABS(v_pref_wind_dir - v_forecast_wind_dir), 360 - ABS(v_pref_wind_dir - v_forecast_wind_dir)) / 180,
    1
  );

  v_base_distance := LEAST(
    0.35 * v_wave_distance +
    0.25 * v_period_distance +
    0.20 * v_wind_distance +
    0.10 * v_tide_distance +
    0.10 * v_wind_dir_distance,
    1.0
  );
  v_base_score := (1.0 - v_base_distance) * 10.0;

  IF v_av_count IS NOT NULL AND v_av_count > 0 THEN
    v_av_wave_distance     := LEAST(ABS(v_av_wave - v_forecast_wave) / GREATEST(v_av_wave, 1), 1);
    v_av_period_distance   := LEAST(ABS(v_av_period - v_forecast_period) / GREATEST(v_av_period, 1), 1);
    v_av_wind_distance     := LEAST(ABS(v_av_wind - v_forecast_wind) / GREATEST(v_av_wind, 5), 1);
    v_av_tide_distance     := LEAST(ABS(v_av_tide - v_forecast_tide) / 3, 1);
    v_av_wind_dir_distance := LEAST(
      LEAST(ABS(v_av_wind_dir - v_forecast_wind_dir), 360 - ABS(v_av_wind_dir - v_forecast_wind_dir)) / 180,
      1
    );

    v_aversion_distance := LEAST(
      0.35 * v_av_wave_distance +
      0.25 * v_av_period_distance +
      0.20 * v_av_wind_distance +
      0.10 * v_av_tide_distance +
      0.10 * v_av_wind_dir_distance,
      1.0
    );
    v_aversion_proximity := 1.0 - v_aversion_distance;
    v_aversion_penalty := v_aversion_proximity * c_aversion_scaling;
  ELSE
    v_aversion_penalty := 0;
  END IF;

  v_score := GREATEST(0, LEAST(10, v_base_score - v_aversion_penalty));

  v_label := CASE
    WHEN v_score >= 8.5 THEN 'EPIC'
    WHEN v_score >= 7.0 THEN 'GOOD'
    WHEN v_score >= 5.5 THEN 'FAIR'
    WHEN v_score >= 3.5 THEN 'RIDEABLE'
    ELSE 'MEH'
  END;

  v_confidence := CASE
    WHEN v_session_count >= 25 THEN 'high'
    WHEN v_session_count >= 10 THEN 'medium'
    ELSE 'low'
  END;

  v_reason_bullets := jsonb_build_array(
    format('Wave height %s ft — profile peak %s ft', round(v_forecast_wave::numeric, 1), round(v_pref_wave::numeric, 1)),
    format('Period %s s — profile peak %s s', round(v_forecast_period::numeric, 0), round(v_pref_period::numeric, 0)),
    format('Wind %s mph — profile peak %s mph', round(v_forecast_wind::numeric, 0), round(v_pref_wind::numeric, 0))
  );

  SELECT
    CASE
      WHEN b.dimensions IS NOT NULL AND b.dimensions <> '' THEN b.name || ' ' || b.dimensions
      ELSE b.name
    END
  INTO v_board_tip
  FROM public.sessions s
  JOIN public.boards b ON b.id = s.board_id
  WHERE s.user_id = p_user_id
    AND s.rating >= 4
    AND s.status = 'completed'
    AND ABS(public.parse_numeric_from_text((SELECT forecast_snapshot->>'wave_height' FROM public.session_forecast_snapshots WHERE session_id = s.id)) - v_forecast_wave) < 1.5
  GROUP BY b.id, b.name, b.dimensions
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'state', 'ready',
    'score', round(v_score::numeric, 1),
    'label', v_label,
    'reason_bullets', v_reason_bullets,
    'board_tip', v_board_tip,
    'confidence', v_confidence,
    'sessions_in_profile', v_session_count,
    'profile_kind', CASE WHEN v_av_count IS NOT NULL AND v_av_count > 0 THEN 'two_sided' ELSE 'preference_only' END,
    'base_score', round(v_base_score::numeric, 2),
    'aversion_penalty', round(v_aversion_penalty::numeric, 2),
    'aversion_sample_count', COALESCE(v_av_count, 0)
  );
END;
$function$;

COMMIT;
