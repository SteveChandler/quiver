-- Session fit match score: promote v1 categorical session_decomposition
-- values into queryable generated columns and feed them into personal match.
--
-- No backfill is needed. Existing JSONB rows compute generated values
-- automatically; rows without the v1 categorical fields stay NULL and keep
-- the old score path because the fit adjustment remains zero.

BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS session_skill_fit text
    GENERATED ALWAYS AS (
      CASE
        WHEN session_decomposition->>'version' = '1'
          AND session_decomposition->>'skill_fit' IN ('under', 'dialed', 'over_my_head')
        THEN session_decomposition->>'skill_fit'
        ELSE NULL
      END
    ) STORED,
  ADD COLUMN IF NOT EXISTS session_board_fit text
    GENERATED ALWAYS AS (
      CASE
        WHEN session_decomposition->>'version' = '1'
          AND session_decomposition->>'board_fit' IN ('too_small', 'right', 'too_much_board', 'wrong_type', 'na')
        THEN session_decomposition->>'board_fit'
        ELSE NULL
      END
    ) STORED;

COMMENT ON COLUMN public.sessions.session_decomposition IS
  'Optional JSONB capturing what shaped the session. v1 shape: { version: 1, waves, crew, vibe, skill_fit, board_fit }. NULL = picker skipped.';

COMMENT ON COLUMN public.sessions.session_skill_fit IS
  'Generated v1 session fit value from session_decomposition.skill_fit: under, dialed, or over_my_head.';

COMMENT ON COLUMN public.sessions.session_board_fit IS
  'Generated v1 board fit value from session_decomposition.board_fit: too_small, right, too_much_board, wrong_type, or na.';

CREATE INDEX IF NOT EXISTS idx_sessions_session_skill_fit
  ON public.sessions (user_id, session_skill_fit, arrival_time DESC)
  WHERE session_skill_fit IS NOT NULL
    AND status = 'completed'
    AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_session_board_fit
  ON public.sessions (user_id, session_board_fit, arrival_time DESC)
  WHERE session_board_fit IS NOT NULL
    AND status = 'completed'
    AND deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.compute_user_match_score_core(
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
  v_session_fit_adjustment numeric := 0;
  v_fit_signal_score numeric;
  v_fit_signal_sample_count integer := 0;
  v_fit_positive_count integer := 0;
  v_fit_negative_count integer := 0;
  v_score numeric;
  v_label text;
  v_confidence text;
  v_reason_bullets jsonb;
  v_board_tip text;
  v_beach_break_type text;

  c_aversion_scaling constant numeric := 3.0;
  c_fit_signal_scaling constant numeric := 1.0;
BEGIN
  -- Gate: need >=5 sessions with rating + snapshot in the last 12 months.
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
      'state', 'starter',
      'session_count', v_session_count,
      'sessions_needed', 5 - v_session_count,
      'fit_label', 'Fits your stated preferences',
      'body', 'This fits your stated preferences. We will get more personal as you rate sessions.',
      'quality_band', 'starter'
    );
  END IF;

  -- Parse forecast inputs.
  v_forecast_wave     := public.parse_numeric_from_text(p_wave_height);
  v_forecast_period   := public.parse_numeric_from_text(p_wave_period);
  v_forecast_wind     := public.parse_numeric_from_text(p_wind_speed);
  v_forecast_wind_dir := public.parse_numeric_from_text(p_wind_direction);
  v_forecast_tide     := public.parse_numeric_from_text(p_tide_height);

  SELECT break_type INTO v_beach_break_type FROM public.beaches WHERE id = p_beach_id;

  -- Preference peak: weighted mean of conditions over sessions with rating >= 4.
  -- Weight = rating - 3 (1 for r=4, 2 for r=5). No contribution from r=3 or r<=2.
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

  -- Aversion peak: weighted mean of conditions over sessions with rating <= 2.
  -- Weight = 3 - rating (1 for r=2, 2 for r=1). No contribution from r=3 or r>=4.
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

  -- Degenerate: all-negative profile (no rating >= 4 samples). Cannot anchor a preference.
  IF v_pref_count IS NULL OR v_pref_count = 0 THEN
    IF v_av_count IS NULL OR v_av_count = 0 THEN
      -- Also no aversion samples -> all rating = 3 sessions. Return honest avoidance-style learned state.
      RETURN jsonb_build_object(
        'state', 'avoidance_learned',
        'score', NULL,
        'fit_label', 'Need a few more ratings',
        'reason_bullets', jsonb_build_array(
          'We know what you tend to avoid. Rate a few good sessions to sharpen your match.'
        ),
        'board_tip', NULL,
        'sessions_in_profile', v_session_count,
        'profile_kind', 'neutral',
        'quality_band', 'mixed_signal'
      );
    END IF;

    -- Aversion only — we know what the user hates but not what they love. Can't score.
    RETURN jsonb_build_object(
      'state', 'avoidance_learned',
      'session_count', v_session_count,
      'sessions_needed', 0,
      'fit_label', 'Need a few more ratings',
      'reason_bullets', jsonb_build_array('We know what you tend to avoid. Rate a few good sessions to sharpen your match.'),
      'score', NULL,
      'quality_band', 'mixed_signal',
      'reason', 'no_positive_sessions'
    );
  END IF;

  -- Base distance (forecast vs preference peak).
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

  -- Aversion penalty (forecast vs aversion peak). Only when we have samples.
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

  -- Fit-signal adjustment: explicit v1 picker feedback nudges nearby windows.
  -- It is bounded and only activates when categorical fit rows exist.
  WITH fit_samples AS (
    SELECT
      CASE
        WHEN s.session_skill_fit = 'dialed' THEN 1.0
        WHEN s.session_skill_fit = 'over_my_head' THEN -1.0
        WHEN s.session_skill_fit = 'under' THEN -0.5
        ELSE 0
      END
      +
      CASE
        WHEN s.session_board_fit = 'right' THEN 0.5
        WHEN s.session_board_fit IN ('too_small', 'too_much_board', 'wrong_type') THEN -0.5
        ELSE 0
      END AS fit_value,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') AS sample_wave,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_period') AS sample_period,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_speed') AS sample_wind,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'wind_direction_deg') AS sample_wind_dir,
      public.parse_numeric_from_text(sfs.forecast_snapshot->>'tide_height') AS sample_tide
    FROM public.sessions s
    JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    LEFT JOIN public.beaches b ON b.id = s.beach_id
    WHERE s.user_id = p_user_id
      AND s.status = 'completed'
      AND s.rating IS NOT NULL
      AND s.arrival_time > now() - interval '12 months'
      AND s.deleted_at IS NULL
      AND sfs.forecast_snapshot IS NOT NULL
      AND (s.session_skill_fit IS NOT NULL OR s.session_board_fit IS NOT NULL)
      AND (v_beach_break_type IS NULL OR b.break_type = v_beach_break_type OR b.break_type IS NULL)
  ),
  scored_fit_samples AS (
    SELECT
      fit_value,
      1.0 - LEAST(
        0.35 * LEAST(ABS(sample_wave - v_forecast_wave) / GREATEST(sample_wave, 1), 1) +
        0.25 * LEAST(ABS(sample_period - v_forecast_period) / GREATEST(sample_period, 1), 1) +
        0.20 * LEAST(ABS(sample_wind - v_forecast_wind) / GREATEST(sample_wind, 5), 1) +
        0.10 * LEAST(ABS(sample_tide - v_forecast_tide) / 3, 1) +
        0.10 * LEAST(
          LEAST(ABS(sample_wind_dir - v_forecast_wind_dir), 360 - ABS(sample_wind_dir - v_forecast_wind_dir)) / 180,
          1
        ),
        1.0
      ) AS fit_proximity
    FROM fit_samples
    WHERE sample_wave IS NOT NULL
      AND sample_period IS NOT NULL
      AND sample_wind IS NOT NULL
      AND sample_wind_dir IS NOT NULL
      AND sample_tide IS NOT NULL
      AND fit_value <> 0
  )
  SELECT
    SUM(fit_value * fit_proximity) / NULLIF(SUM(fit_proximity), 0),
    COUNT(*)::integer,
    COUNT(*) FILTER (WHERE fit_value > 0)::integer,
    COUNT(*) FILTER (WHERE fit_value < 0)::integer
  INTO
    v_fit_signal_score,
    v_fit_signal_sample_count,
    v_fit_positive_count,
    v_fit_negative_count
  FROM scored_fit_samples
  WHERE fit_proximity > 0.15;

  IF COALESCE(v_fit_signal_sample_count, 0) > 0 THEN
    v_session_fit_adjustment := GREATEST(
      -1.0,
      LEAST(1.0, COALESCE(v_fit_signal_score, 0) * c_fit_signal_scaling)
    );
  ELSE
    v_session_fit_adjustment := 0;
  END IF;

  v_score := GREATEST(0, LEAST(10, v_base_score - v_aversion_penalty + v_session_fit_adjustment));

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

  IF COALESCE(v_fit_signal_sample_count, 0) > 0 THEN
    v_reason_bullets := v_reason_bullets || jsonb_build_array(
      CASE
        WHEN v_session_fit_adjustment > 0.15 THEN 'Your session fit feedback lifts this window.'
        WHEN v_session_fit_adjustment < -0.15 THEN 'Similar sessions were flagged as a skill or board mismatch.'
        ELSE 'Your session fit feedback is neutral for this window.'
      END
    );
  END IF;

  -- Board tip: most-used board at rating >=4 sessions with nearby wave height.
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
    'state', 'learned',
    'score', round(v_score::numeric, 1),
    'label', v_label,
    'reason_bullets', v_reason_bullets,
    'board_tip', v_board_tip,
    'confidence', v_confidence,
    'sessions_in_profile', v_session_count,
    'profile_kind', CASE WHEN v_av_count IS NOT NULL AND v_av_count > 0 THEN 'two_sided' ELSE 'preference_only' END,
    'quality_band', CASE WHEN v_session_count >= 15 THEN 'dense_signal' ELSE 'session_backed' END,
    'base_score', round(v_base_score::numeric, 2),
    'aversion_penalty', round(v_aversion_penalty::numeric, 2),
    'aversion_sample_count', COALESCE(v_av_count, 0),
    'fit_signal_adjustment', round(v_session_fit_adjustment::numeric, 2),
    'fit_signal_sample_count', COALESCE(v_fit_signal_sample_count, 0),
    'fit_signal_positive_count', COALESCE(v_fit_positive_count, 0),
    'fit_signal_negative_count', COALESCE(v_fit_negative_count, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.compute_user_match_score(
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
SET search_path TO 'public'
AS $function$
DECLARE
  v_role text := COALESCE(auth.role(), 'anon');
  v_caller uuid := auth.uid();
  v_is_paid boolean := false;
  v_billing_issue boolean := false;
  v_expires_at timestamptz;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_caller IS NULL OR p_user_id <> v_caller THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Personal match unlocks with your account',
        'reason_bullets', jsonb_build_array('Sign in with the matching account to use personal match.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'forbidden'
      );
    END IF;

    SELECT
      COALESCE(ue.is_pro, false) OR COALESCE(ue.is_trialing, false),
      COALESCE(ue.billing_issue, false),
      ue.expires_at
    INTO v_is_paid, v_billing_issue, v_expires_at
    FROM public.user_entitlements ue
    WHERE ue.user_id = p_user_id
    LIMIT 1;

    IF v_billing_issue THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Update payment to use personal match',
        'reason_bullets', jsonb_build_array('Your forecast is still here. Update your payment method to turn personal match back on.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'billing_issue'
      );
    END IF;

    IF NOT COALESCE(v_is_paid, false) OR (v_expires_at IS NOT NULL AND v_expires_at < now()) THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Personal match unlocks with Pro',
        'reason_bullets', jsonb_build_array('Forecasts stay free. Pro adds your fit, reasons, ranked windows, and personal alerts.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'free'
      );
    END IF;
  END IF;

  RETURN public.compute_user_match_score_core(
    p_user_id,
    p_beach_id,
    p_wave_height,
    p_wave_period,
    p_wind_speed,
    p_wind_direction,
    p_tide_height
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_user_match_score(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_user_match_score(uuid, uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.compute_user_match_score(uuid, uuid, text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
