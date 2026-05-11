-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- A5: Replace stub ready branch with real scoring. Labels use design-system
-- tokens (EPIC / GOOD / FAIR / RIDEABLE / MEH), NOT the plan's original
-- Perfect/Great/Good/Off/Skip — see plan's Design System Compliance
-- amendment. Gate uses `rating IS NOT NULL`; profile aggregation excludes
-- `rating = 3` (neutral = zero weight per spec).

CREATE OR REPLACE FUNCTION public.parse_numeric_from_text(input text) RETURNS numeric
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(
    (regexp_match(input, '(-?\d+\.?\d*)'))[1]::numeric,
    0
  );
$$;

CREATE OR REPLACE FUNCTION public.compute_user_match_score(
  p_user_id uuid,
  p_beach_id uuid,
  p_wave_height text,
  p_wave_period text,
  p_wind_speed text,
  p_wind_direction text,
  p_tide_height text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_count integer;
  v_profile record;
  v_forecast_wave numeric;
  v_forecast_period numeric;
  v_forecast_wind numeric;
  v_forecast_wind_dir numeric;
  v_forecast_tide numeric;
  v_wave_distance numeric;
  v_period_distance numeric;
  v_wind_distance numeric;
  v_tide_distance numeric;
  v_raw_score numeric;
  v_score numeric;
  v_label text;
  v_confidence text;
  v_reason_bullets jsonb;
  v_board_tip text;
  v_beach_break_type text;
BEGIN
  -- Gate: unrated sessions do not count (rating IS NOT NULL).
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

  -- Parse forecast inputs.
  v_forecast_wave := public.parse_numeric_from_text(p_wave_height);
  v_forecast_period := public.parse_numeric_from_text(p_wave_period);
  v_forecast_wind := public.parse_numeric_from_text(p_wind_speed);
  v_forecast_wind_dir := public.parse_numeric_from_text(p_wind_direction);
  v_forecast_tide := public.parse_numeric_from_text(p_tide_height);

  -- Beach break type for filter (column is `break_type`, not beach_type).
  SELECT break_type INTO v_beach_break_type FROM public.beaches WHERE id = p_beach_id;

  -- Build preference profile: weighted mean of conditions across rated
  -- sessions matching break_type, weighted by (rating - 3). Neutral sessions
  -- (rating = 3) contribute zero weight.
  SELECT
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') * (s.rating - 3))
      / NULLIF(SUM(ABS(s.rating - 3)), 0) AS pref_wave,
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') * (s.rating - 3))
      / NULLIF(SUM(ABS(s.rating - 3)), 0) AS pref_period,
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') * (s.rating - 3))
      / NULLIF(SUM(ABS(s.rating - 3)), 0) AS pref_wind,
    SUM(public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') * (s.rating - 3))
      / NULLIF(SUM(ABS(s.rating - 3)), 0) AS pref_tide
  INTO v_profile
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  LEFT JOIN public.beaches b ON b.id = s.beach_id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating IS NOT NULL
    AND s.rating <> 3
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL
    AND (v_beach_break_type IS NULL OR b.break_type = v_beach_break_type OR b.break_type IS NULL);

  -- Distances (normalized). Fall back to zero distance when profile has no
  -- data for that dimension (NULL divisor guard).
  v_wave_distance := ABS(COALESCE(v_profile.pref_wave, v_forecast_wave) - v_forecast_wave) / GREATEST(COALESCE(v_profile.pref_wave, 1), 1);
  v_period_distance := ABS(COALESCE(v_profile.pref_period, v_forecast_period) - v_forecast_period) / GREATEST(COALESCE(v_profile.pref_period, 1), 1);
  v_wind_distance := ABS(COALESCE(v_profile.pref_wind, v_forecast_wind) - v_forecast_wind) / GREATEST(COALESCE(v_profile.pref_wind, 5), 5);
  v_tide_distance := ABS(COALESCE(v_profile.pref_tide, v_forecast_tide) - v_forecast_tide) / GREATEST(ABS(COALESCE(v_profile.pref_tide, 3)), 3);

  -- Weighted score: wave_height (0.35) > period (0.25) > wind_speed (0.20) > tide (0.10)
  -- (wind_direction 0.10 deferred; covered in a later task once forecast
  -- payloads carry a numeric wind direction consistently).
  v_raw_score := 1.0 - LEAST(
    0.35 * v_wave_distance +
    0.25 * v_period_distance +
    0.20 * v_wind_distance +
    0.10 * v_tide_distance,
    1.0
  );
  v_score := GREATEST(0, LEAST(10, v_raw_score * 10));

  -- Design-system label bands.
  v_label := CASE
    WHEN v_score >= 8.5 THEN 'EPIC'
    WHEN v_score >= 7.0 THEN 'GOOD'
    WHEN v_score >= 5.5 THEN 'FAIR'
    WHEN v_score >= 3.5 THEN 'RIDEABLE'
    ELSE 'MEH'
  END;

  -- Confidence bands (5-9 low, 10-24 medium, 25+ high).
  v_confidence := CASE
    WHEN v_session_count >= 25 THEN 'high'
    WHEN v_session_count >= 10 THEN 'medium'
    ELSE 'low'
  END;

  -- Reason bullets — v1: describe forecast vs profile peak on the 3 top-weight bands.
  v_reason_bullets := jsonb_build_array(
    format('Wave height %s ft — profile peak %s ft', round(v_forecast_wave::numeric, 1), round(COALESCE(v_profile.pref_wave, 0)::numeric, 1)),
    format('Period %s s — profile peak %s s', round(v_forecast_period::numeric, 0), round(COALESCE(v_profile.pref_period, 0)::numeric, 0)),
    format('Wind %s mph — profile peak %s mph', round(v_forecast_wind::numeric, 0), round(COALESCE(v_profile.pref_wind, 0)::numeric, 0))
  );

  -- Board tip: user's most-used board for sessions rated >=4 at similar wave heights.
  SELECT b.name || ' ' || COALESCE(b.length_feet::text || '''' || COALESCE(b.length_inches::text, '0') || '"', '')
  INTO v_board_tip
  FROM public.sessions s
  JOIN public.boards b ON b.id = s.board_id
  WHERE s.user_id = p_user_id
    AND s.rating >= 4
    AND s.status = 'completed'
    AND ABS(public.parse_numeric_from_text((SELECT forecast_snapshot->>'wave_height' FROM public.session_forecast_snapshots WHERE session_id = s.id)) - v_forecast_wave) < 1.5
  GROUP BY b.id, b.name, b.length_feet, b.length_inches
  ORDER BY COUNT(*) DESC
  LIMIT 1;

  RETURN jsonb_build_object(
    'state', 'ready',
    'score', round(v_score::numeric, 1),
    'label', v_label,
    'reason_bullets', v_reason_bullets,
    'board_tip', v_board_tip,
    'confidence', v_confidence,
    'sessions_in_profile', v_session_count
  );
END;
$$;

NOTIFY pgrst, 'reload schema';
