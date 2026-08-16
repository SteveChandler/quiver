-- Board alias correction for compute_user_match_score_core.
--
-- Supersedes 20260622064000_coldstart_prior_match_score.sql, which is the
-- migration that currently defines this function in production. The body here
-- is that file verbatim except for its two board alias maps:
--
--   * `thruster` no longer maps to `shortboard`. A fin setup is not a board
--     shape and must produce no board shaping. This diverged from the
--     TypeScript normaliser and reached production via an in-place edit of an
--     already-applied migration, which changed the file but not the database.
--   * `mini-mid` added to the mid-length aliases.
--
-- Both maps are corrected; correcting only one was a prior failed attempt.
-- Cold-start behaviour below is unchanged and must stay unchanged: replacing
-- this function with the pre-coldstart body would silently delete the starter
-- score for every user under 5 rated sessions.
--
-- NOT YET APPLIED. Awaiting owner approval.
--
-- Inherited notes from the superseded migration follow.
--
-- Cold-start prior match score: return a real starter score before the user's
-- learned profile reaches 5 rated sessions.
--
-- This migration only replaces compute_user_match_score_core. It preserves the
-- public wrapper, grants, and the learned n >= 5 path below the "Parse forecast
-- inputs" marker while replacing the n < 5 placeholder with a skill + spot
-- prior score. No schema change or backfill is needed.
-- Production apply is review-gated; branch verification is required first.
-- Mirrors SKILL_WAVE_RANGES and BOARD_SHAPE from web rideability constants.

BEGIN;

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
  v_cap_ceiling numeric;
  v_cap_sample integer := 0;
  v_skill_fit_net numeric;
  v_profile_skill text;
  v_resolved_skill text := 'intermediate';
  v_skill_source text := 'default';
  v_board_class text;
  v_skill_ideal_min numeric;
  v_skill_ideal_max numeric;
  v_skill_acceptable_min numeric;
  v_skill_acceptable_max numeric;
  v_board_shape_lo numeric;
  v_board_shape_hi numeric;
  v_board_ideal_min numeric;
  v_board_ideal_max numeric;
  v_board_acceptable_min numeric;
  v_board_acceptable_max numeric;
  v_board_band_adjustment numeric := 0;
  v_spot_swell_min_deg numeric;
  v_spot_swell_max_deg numeric;
  v_spot_wind_offshore_deg numeric;
  v_spot_wind_offshore_tol_deg numeric;
  v_spot_tide_min_ft numeric;
  v_spot_tide_max_ft numeric;
  v_prior_wave numeric;
  v_prior_wind_dir numeric;
  v_prior_tide numeric;
  v_prior_wave_distance numeric;
  v_prior_wind_dir_distance numeric;
  v_prior_tide_distance numeric;
  v_prior_weighted_distance numeric := 0;
  v_prior_weight_total numeric := 0;
  v_prior_score numeric;
  v_prior_dimensions jsonb := jsonb_build_array('skill_wave');
  v_prior_has_spot_profile boolean := false;
  v_blend_weight numeric;
  v_prior_fit_label text;
  v_prior_body text;
  v_score numeric;
  v_label text;
  v_confidence text;
  v_reason_bullets jsonb;
  v_board_tip text;
  v_beach_break_type text;

  c_aversion_scaling constant numeric := 3.0;
  c_fit_signal_scaling constant numeric := 1.0;
  c_capability_min_samples constant integer := 5;
  c_skill_fit_ceiling_weight constant numeric := 0.15;
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
    -- Starter prior: real forecast-sensitive score before the learned profile is ready.
    v_forecast_wave     := public.parse_numeric_from_text(p_wave_height);
    v_forecast_period   := public.parse_numeric_from_text(p_wave_period);
    v_forecast_wind     := public.parse_numeric_from_text(p_wind_speed);
    v_forecast_wind_dir := public.parse_numeric_from_text(p_wind_direction);
    v_forecast_tide     := public.parse_numeric_from_text(p_tide_height);

    SELECT
      b.break_type,
      b.swell_window_min_deg,
      b.swell_window_max_deg,
      b.wind_offshore_deg,
      b.wind_offshore_tol_deg,
      b.preferred_tide_ft_min,
      b.preferred_tide_ft_max
    INTO
      v_beach_break_type,
      v_spot_swell_min_deg,
      v_spot_swell_max_deg,
      v_spot_wind_offshore_deg,
      v_spot_wind_offshore_tol_deg,
      v_spot_tide_min_ft,
      v_spot_tide_max_ft
    FROM public.beaches b
    WHERE b.id = p_beach_id;

    SELECT lower(trim(p.experience_level))
    INTO v_profile_skill
    FROM public.profiles p
    WHERE p.id = p_user_id;

    v_profile_skill := NULLIF(v_profile_skill, '');

    WITH board_usage AS (
      SELECT
        COALESCE(s.board_id::text, s.board_snapshot->>'name', s.board_snapshot->>'board_type') AS board_key,
        COALESCE(s.board_snapshot->>'board_type', b.board_type) AS board_type,
        COALESCE(s.board_snapshot->>'name', b.name) AS name,
        COUNT(*)::integer AS use_count,
        MAX(s.arrival_time) AS last_used_at
      FROM public.sessions s
      LEFT JOIN public.boards b ON b.id = s.board_id
      JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
      WHERE s.user_id = p_user_id
        AND s.rating >= 4
        AND s.status = 'completed'
        AND s.arrival_time > now() - interval '12 months'
        AND s.deleted_at IS NULL
        AND sfs.forecast_snapshot IS NOT NULL
      GROUP BY
        COALESCE(s.board_id::text, s.board_snapshot->>'name', s.board_snapshot->>'board_type'),
        COALESCE(s.board_snapshot->>'board_type', b.board_type),
        COALESCE(s.board_snapshot->>'name', b.name)
    ),
    board_keys AS (
      SELECT
        board_key,
        use_count,
        last_used_at,
        0 AS source_priority,
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(trim(COALESCE(board_type, ''))), '[[:space:]_]+', '-', 'g'),
            '-+',
            '-',
            'g'
          ),
          '(^-+|-+$)',
          '',
          'g'
        ) AS key
      FROM board_usage
      WHERE board_type IS NOT NULL AND trim(board_type) <> ''

      UNION ALL

      SELECT
        board_key,
        use_count,
        last_used_at,
        1 AS source_priority,
        regexp_replace(
          regexp_replace(
            regexp_replace(lower(trim(COALESCE(name, ''))), '[[:space:]_]+', '-', 'g'),
            '-+',
            '-',
            'g'
          ),
          '(^-+|-+$)',
          '',
          'g'
        ) AS key
      FROM board_usage
      WHERE name IS NOT NULL AND trim(name) <> ''
    ),
    board_classes AS (
      SELECT
        board_key,
        use_count,
        last_used_at,
        source_priority,
        CASE
          WHEN key IN ('foamie', 'foam', 'foamboard', 'foam-board', 'soft', 'softboard', 'soft-board', 'softtop', 'soft-top', 'softtopboard', 'soft-top-board')
            OR replace(key, '-', '') IN ('foamie', 'foam', 'foamboard', 'soft', 'softboard', 'softtop', 'softtopboard')
          THEN 'foamie'
          WHEN key IN ('longboard', 'long-board', 'log', 'longboard-single-fin', 'longboard-2-plus-1')
            OR replace(key, '-', '') IN ('longboard', 'longboard21')
          THEN 'longboard'
          WHEN key IN ('midlength', 'mid-length', 'mini-mid', 'egg')
            OR replace(key, '-', '') = 'midlength'
          THEN 'mid-length'
          WHEN key IN ('funboard', 'fun-board', 'mini', 'minimal', 'mini-mal', 'mini-simmons')
            OR replace(key, '-', '') IN ('funboard', 'minisimmons')
          THEN 'funboard'
          WHEN key IN ('fish', 'twin', 'twin-pin', 'groveler')
            OR replace(key, '-', '') = 'twinpin'
          THEN 'fish'
          WHEN key IN ('shortboard', 'short-board')
            OR replace(key, '-', '') = 'shortboard'
          THEN 'shortboard'
          WHEN key IN ('step-up', 'stepup')
            OR replace(key, '-', '') = 'stepup'
          THEN 'step-up'
          WHEN key = 'gun' THEN 'gun'
          WHEN key IN ('sup', 'standuppaddle', 'standuppaddleboard', 'stand-up-paddle', 'stand-up-paddleboard', 'paddleboard', 'paddle-board')
            OR replace(key, '-', '') IN ('sup', 'standuppaddle', 'standuppaddleboard', 'paddleboard')
          THEN 'sup'
          WHEN key = 'foil' THEN 'foil'
          WHEN key IN ('bodyboard', 'body-board', 'boogie', 'boogieboard', 'boogie-board')
            OR replace(key, '-', '') IN ('bodyboard', 'boogieboard')
          THEN 'bodyboard'
          ELSE NULL
        END AS board_class
      FROM board_keys
      WHERE key <> ''
    )
    SELECT board_class
    INTO v_board_class
    FROM board_classes
    WHERE board_class IS NOT NULL
    ORDER BY use_count DESC, last_used_at DESC NULLS LAST, source_priority ASC, board_key
    LIMIT 1;

    IF v_profile_skill IN ('beginner', 'intermediate', 'advanced', 'expert') THEN
      v_resolved_skill := v_profile_skill;
      v_skill_source := 'profile';
    ELSIF v_board_class IS NOT NULL THEN
      v_resolved_skill := CASE v_board_class
        WHEN 'foamie' THEN 'beginner'
        WHEN 'longboard' THEN 'beginner'
        WHEN 'sup' THEN 'beginner'
        WHEN 'foil' THEN 'beginner'
        WHEN 'funboard' THEN 'intermediate'
        WHEN 'fish' THEN 'intermediate'
        WHEN 'mid-length' THEN 'intermediate'
        WHEN 'bodyboard' THEN 'intermediate'
        WHEN 'shortboard' THEN 'intermediate'
        WHEN 'step-up' THEN 'advanced'
        WHEN 'gun' THEN 'advanced'
        ELSE 'intermediate'
      END;
      v_skill_source := 'board_prior';
    ELSE
      v_resolved_skill := 'intermediate';
      v_skill_source := 'default';
    END IF;

    v_prior_wave := CASE v_resolved_skill
      WHEN 'beginner' THEN 2.0
      WHEN 'intermediate' THEN 3.5
      WHEN 'advanced' THEN 5.5
      WHEN 'expert' THEN 8.0
      ELSE 3.5
    END;

    v_prior_wind_dir := v_spot_wind_offshore_deg;
    IF v_spot_tide_min_ft IS NOT NULL AND v_spot_tide_max_ft IS NOT NULL THEN
      v_prior_tide := (v_spot_tide_min_ft + v_spot_tide_max_ft) / 2.0;
    END IF;

    -- If a few positive sessions exist, shrink the prior toward the early learned peak.
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

    IF COALESCE(v_pref_count, 0) > 0 THEN
      v_blend_weight := v_session_count::numeric / (v_session_count::numeric + 5.0);

      IF v_pref_wave IS NOT NULL THEN
        v_prior_wave := v_blend_weight * v_pref_wave + (1.0 - v_blend_weight) * v_prior_wave;
      END IF;

      IF v_pref_wind_dir IS NOT NULL AND v_prior_wind_dir IS NOT NULL THEN
        IF ABS(v_pref_wind_dir - v_prior_wind_dir) > 180 THEN
          IF v_pref_wind_dir > v_prior_wind_dir THEN
            v_prior_wind_dir := v_prior_wind_dir + 360;
          ELSE
            v_pref_wind_dir := v_pref_wind_dir + 360;
          END IF;
        END IF;
        v_prior_wind_dir := mod(v_blend_weight * v_pref_wind_dir + (1.0 - v_blend_weight) * v_prior_wind_dir, 360);
      END IF;

      IF v_pref_tide IS NOT NULL AND v_prior_tide IS NOT NULL THEN
        v_prior_tide := v_blend_weight * v_pref_tide + (1.0 - v_blend_weight) * v_prior_tide;
      END IF;
    END IF;

    v_prior_wave_distance := LEAST(ABS(v_prior_wave - COALESCE(v_forecast_wave, v_prior_wave)) / GREATEST(v_prior_wave, 1), 1);
    v_prior_weighted_distance := v_prior_weighted_distance + 0.35 * v_prior_wave_distance;
    v_prior_weight_total := v_prior_weight_total + 0.35;

    IF v_prior_wind_dir IS NOT NULL AND v_forecast_wind_dir IS NOT NULL THEN
      v_prior_wind_dir_distance := LEAST(
        LEAST(ABS(v_prior_wind_dir - v_forecast_wind_dir), 360 - ABS(v_prior_wind_dir - v_forecast_wind_dir)) / 180,
        1
      );
      v_prior_weighted_distance := v_prior_weighted_distance + 0.10 * v_prior_wind_dir_distance;
      v_prior_weight_total := v_prior_weight_total + 0.10;
      v_prior_dimensions := v_prior_dimensions || jsonb_build_array('spot_wind_direction');
      v_prior_has_spot_profile := true;
    END IF;

    IF v_prior_tide IS NOT NULL AND v_forecast_tide IS NOT NULL THEN
      v_prior_tide_distance := LEAST(ABS(v_prior_tide - v_forecast_tide) / 3, 1);
      v_prior_weighted_distance := v_prior_weighted_distance + 0.10 * v_prior_tide_distance;
      v_prior_weight_total := v_prior_weight_total + 0.10;
      v_prior_dimensions := v_prior_dimensions || jsonb_build_array('spot_tide');
      v_prior_has_spot_profile := true;
    END IF;

    v_prior_score := GREATEST(
      0,
      LEAST(10, (1.0 - LEAST(v_prior_weighted_distance / NULLIF(v_prior_weight_total, 0), 1.0)) * 10.0)
    );
    v_prior_fit_label := CASE
      WHEN v_prior_has_spot_profile THEN 'Based on your skill + this spot'
      ELSE 'Based on your skill level'
    END;
    v_prior_body := 'A starter read from your skill'
      || CASE WHEN v_prior_has_spot_profile THEN ' and this spot''s setup' ELSE '' END
      || '. It gets more personal as you rate sessions.';

    RETURN jsonb_build_object(
      'state', 'starter',
      'score', round(v_prior_score::numeric, 1),
      'session_count', v_session_count,
      'sessions_needed', 5 - v_session_count,
      'fit_label', v_prior_fit_label,
      'body', v_prior_body,
      'quality_band', 'starter',
      'prior_dimensions', v_prior_dimensions,
      'skill_used', v_resolved_skill,
      'skill_source', v_skill_source,
      'board_class', v_board_class
    );
  END IF;

  -- Parse forecast inputs.
  v_forecast_wave     := public.parse_numeric_from_text(p_wave_height);
  v_forecast_period   := public.parse_numeric_from_text(p_wave_period);
  v_forecast_wind     := public.parse_numeric_from_text(p_wind_speed);
  v_forecast_wind_dir := public.parse_numeric_from_text(p_wind_direction);
  v_forecast_tide     := public.parse_numeric_from_text(p_tide_height);

  SELECT break_type INTO v_beach_break_type FROM public.beaches WHERE id = p_beach_id;

  SELECT lower(trim(p.experience_level))
  INTO v_profile_skill
  FROM public.profiles p
  WHERE p.id = p_user_id;

  v_profile_skill := NULLIF(v_profile_skill, '');

  WITH board_usage AS (
    SELECT
      COALESCE(s.board_id::text, s.board_snapshot->>'name', s.board_snapshot->>'board_type') AS board_key,
      COALESCE(s.board_snapshot->>'board_type', b.board_type) AS board_type,
      COALESCE(s.board_snapshot->>'name', b.name) AS name,
      COUNT(*)::integer AS use_count,
      MAX(s.arrival_time) AS last_used_at
    FROM public.sessions s
    LEFT JOIN public.boards b ON b.id = s.board_id
    JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
    WHERE s.user_id = p_user_id
      AND s.rating >= 4
      AND s.status = 'completed'
      AND s.arrival_time > now() - interval '12 months'
      AND s.deleted_at IS NULL
      AND sfs.forecast_snapshot IS NOT NULL
    GROUP BY
      COALESCE(s.board_id::text, s.board_snapshot->>'name', s.board_snapshot->>'board_type'),
      COALESCE(s.board_snapshot->>'board_type', b.board_type),
      COALESCE(s.board_snapshot->>'name', b.name)
  ),
  board_keys AS (
    SELECT
      board_key,
      use_count,
      last_used_at,
      0 AS source_priority,
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(COALESCE(board_type, ''))), '[[:space:]_]+', '-', 'g'),
          '-+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ) AS key
    FROM board_usage
    WHERE board_type IS NOT NULL AND trim(board_type) <> ''

    UNION ALL

    SELECT
      board_key,
      use_count,
      last_used_at,
      1 AS source_priority,
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(trim(COALESCE(name, ''))), '[[:space:]_]+', '-', 'g'),
          '-+',
          '-',
          'g'
        ),
        '(^-+|-+$)',
        '',
        'g'
      ) AS key
    FROM board_usage
    WHERE name IS NOT NULL AND trim(name) <> ''
  ),
  board_classes AS (
    SELECT
      board_key,
      use_count,
      last_used_at,
      source_priority,
      CASE
        WHEN key IN ('foamie', 'foam', 'foamboard', 'foam-board', 'soft', 'softboard', 'soft-board', 'softtop', 'soft-top', 'softtopboard', 'soft-top-board')
          OR replace(key, '-', '') IN ('foamie', 'foam', 'foamboard', 'soft', 'softboard', 'softtop', 'softtopboard')
        THEN 'foamie'
        WHEN key IN ('longboard', 'long-board', 'log', 'longboard-single-fin', 'longboard-2-plus-1')
          OR replace(key, '-', '') IN ('longboard', 'longboard21')
        THEN 'longboard'
        WHEN key IN ('midlength', 'mid-length', 'mini-mid', 'egg')
          OR replace(key, '-', '') = 'midlength'
        THEN 'mid-length'
        WHEN key IN ('funboard', 'fun-board', 'mini', 'minimal', 'mini-mal', 'mini-simmons')
          OR replace(key, '-', '') IN ('funboard', 'minisimmons')
        THEN 'funboard'
        WHEN key IN ('fish', 'twin', 'twin-pin', 'groveler')
          OR replace(key, '-', '') = 'twinpin'
        THEN 'fish'
        WHEN key IN ('shortboard', 'short-board')
          OR replace(key, '-', '') = 'shortboard'
        THEN 'shortboard'
        WHEN key IN ('step-up', 'stepup')
          OR replace(key, '-', '') = 'stepup'
        THEN 'step-up'
        WHEN key = 'gun' THEN 'gun'
        WHEN key IN ('sup', 'standuppaddle', 'standuppaddleboard', 'stand-up-paddle', 'stand-up-paddleboard', 'paddleboard', 'paddle-board')
          OR replace(key, '-', '') IN ('sup', 'standuppaddle', 'standuppaddleboard', 'paddleboard')
        THEN 'sup'
        WHEN key = 'foil' THEN 'foil'
        WHEN key IN ('bodyboard', 'body-board', 'boogie', 'boogieboard', 'boogie-board')
          OR replace(key, '-', '') IN ('bodyboard', 'boogieboard')
        THEN 'bodyboard'
        ELSE NULL
      END AS board_class
    FROM board_keys
    WHERE key <> ''
  )
  SELECT board_class
  INTO v_board_class
  FROM board_classes
  WHERE board_class IS NOT NULL
  ORDER BY use_count DESC, last_used_at DESC NULLS LAST, source_priority ASC, board_key
  LIMIT 1;

  -- Capability ceiling: the size this user demonstrably rides well.
  -- Deliberately distinct from the weighted-mean preference peak below.
  SELECT
    percentile_cont(0.85) WITHIN GROUP (
      ORDER BY public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height')
    )::numeric,
    COUNT(*)::integer,
    AVG(
      CASE s.session_skill_fit
        WHEN 'dialed' THEN 1.0
        WHEN 'under' THEN -0.5
        WHEN 'over_my_head' THEN -1.0
        ELSE 0
      END
    )
  INTO v_cap_ceiling, v_cap_sample, v_skill_fit_net
  FROM public.sessions s
  JOIN public.session_forecast_snapshots sfs ON sfs.session_id = s.id
  WHERE s.user_id = p_user_id
    AND s.status = 'completed'
    AND s.rating >= 4
    AND s.arrival_time > now() - interval '12 months'
    AND s.deleted_at IS NULL
    AND sfs.forecast_snapshot IS NOT NULL
    AND public.parse_numeric_from_text(sfs.forecast_snapshot->>'wave_height') IS NOT NULL;

  IF v_cap_ceiling IS NOT NULL THEN
    v_cap_ceiling := GREATEST(
      0.5,
      v_cap_ceiling * (1.0 + c_skill_fit_ceiling_weight * COALESCE(v_skill_fit_net, 0))
    );
  END IF;

  IF v_cap_sample >= c_capability_min_samples AND v_cap_ceiling IS NOT NULL THEN
    v_resolved_skill := CASE
      WHEN v_cap_ceiling <= 3 THEN 'beginner'
      WHEN v_cap_ceiling <= 5 THEN 'intermediate'
      WHEN v_cap_ceiling <= 8 THEN 'advanced'
      ELSE 'expert'
    END;
    v_skill_source := 'session_derived';
  ELSIF v_profile_skill IN ('beginner', 'intermediate', 'advanced', 'expert') THEN
    v_resolved_skill := v_profile_skill;
    v_skill_source := 'profile';
  ELSIF v_board_class IS NOT NULL THEN
    v_resolved_skill := CASE v_board_class
      WHEN 'foamie' THEN 'beginner'
      WHEN 'longboard' THEN 'beginner'
      WHEN 'sup' THEN 'beginner'
      WHEN 'foil' THEN 'beginner'
      WHEN 'funboard' THEN 'intermediate'
      WHEN 'fish' THEN 'intermediate'
      WHEN 'mid-length' THEN 'intermediate'
      WHEN 'bodyboard' THEN 'intermediate'
      WHEN 'shortboard' THEN 'intermediate'
      WHEN 'step-up' THEN 'advanced'
      WHEN 'gun' THEN 'advanced'
      ELSE 'intermediate'
    END;
    v_skill_source := 'board_prior';
  ELSE
    v_resolved_skill := 'intermediate';
    v_skill_source := 'default';
  END IF;

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

  SELECT
    CASE v_resolved_skill
      WHEN 'intermediate' THEN 2.0
      WHEN 'advanced' THEN 3.0
      WHEN 'expert' THEN 4.0
      ELSE 1.0
    END,
    CASE v_resolved_skill
      WHEN 'intermediate' THEN 5.0
      WHEN 'advanced' THEN 8.0
      WHEN 'expert' THEN 12.0
      ELSE 3.0
    END,
    CASE v_resolved_skill
      WHEN 'intermediate' THEN 1.0
      WHEN 'advanced' THEN 2.0
      WHEN 'expert' THEN 2.0
      ELSE 0.5
    END,
    CASE v_resolved_skill
      WHEN 'intermediate' THEN 6.0
      WHEN 'advanced' THEN 12.0
      WHEN 'expert' THEN 20.0
      ELSE 4.0
    END
  INTO
    v_skill_ideal_min,
    v_skill_ideal_max,
    v_skill_acceptable_min,
    v_skill_acceptable_max;

  SELECT
    CASE v_board_class
      WHEN 'foamie' THEN 0.5
      WHEN 'longboard' THEN 0.5
      WHEN 'mid-length' THEN 0.7
      WHEN 'funboard' THEN 0.6
      WHEN 'fish' THEN 0.85
      WHEN 'shortboard' THEN 1.15
      WHEN 'step-up' THEN 1.4
      WHEN 'gun' THEN 1.6
      WHEN 'sup' THEN 0.4
      WHEN 'foil' THEN 0.2
      WHEN 'bodyboard' THEN 1.0
      ELSE NULL
    END,
    CASE v_board_class
      WHEN 'foamie' THEN 0.6
      WHEN 'longboard' THEN 0.7
      WHEN 'mid-length' THEN 0.85
      WHEN 'funboard' THEN 0.8
      WHEN 'fish' THEN 0.95
      WHEN 'shortboard' THEN 1.05
      WHEN 'step-up' THEN 1.15
      WHEN 'gun' THEN 1.2
      WHEN 'sup' THEN 0.6
      WHEN 'foil' THEN 0.5
      WHEN 'bodyboard' THEN 1.0
      ELSE NULL
    END
  INTO v_board_shape_lo, v_board_shape_hi;

  IF v_board_class IS NOT NULL
    AND v_board_shape_lo IS NOT NULL
    AND v_board_shape_hi IS NOT NULL
    AND v_forecast_wave IS NOT NULL
  THEN
    v_board_ideal_min := GREATEST(0.3, round((v_skill_ideal_min * v_board_shape_lo)::numeric, 1));
    v_board_ideal_max := GREATEST(v_board_ideal_min + 0.5, round((v_skill_ideal_max * v_board_shape_hi)::numeric, 1));
    v_board_acceptable_min := GREATEST(0.3, round((v_skill_acceptable_min * v_board_shape_lo)::numeric, 1));
    v_board_acceptable_max := GREATEST(v_board_acceptable_min + 0.5, round((v_skill_acceptable_max * v_board_shape_hi)::numeric, 1));

    IF v_forecast_wave >= v_board_ideal_min AND v_forecast_wave <= v_board_ideal_max THEN
      v_board_band_adjustment := 0.5;
    ELSIF v_forecast_wave < v_board_acceptable_min THEN
      v_board_band_adjustment := -LEAST(
        1.0,
        GREATEST(0.5, round(((v_board_acceptable_min - v_forecast_wave) * 0.5)::numeric, 2))
      );
    ELSIF v_forecast_wave > v_board_acceptable_max THEN
      v_board_band_adjustment := -LEAST(
        1.0,
        GREATEST(0.5, round(((v_forecast_wave - v_board_acceptable_max) * 0.5)::numeric, 2))
      );
    ELSE
      v_board_band_adjustment := 0;
    END IF;
  ELSE
    v_board_band_adjustment := 0;
  END IF;

  v_score := GREATEST(
    0,
    LEAST(
      10,
      v_base_score - v_aversion_penalty + v_session_fit_adjustment + v_board_band_adjustment
    )
  );

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

  IF v_board_class IS NOT NULL AND ABS(v_board_band_adjustment) >= 0.15 THEN
    v_reason_bullets := v_reason_bullets || jsonb_build_array(
      CASE
        WHEN v_board_band_adjustment > 0 THEN format('Your %s band fits this wave height.', v_board_class)
        ELSE format('This wave height is outside your usual %s band.', v_board_class)
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
    'fit_signal_negative_count', COALESCE(v_fit_negative_count, 0),
    'skill_used', v_resolved_skill,
    'skill_source', v_skill_source,
    'board_class', v_board_class,
    'board_band_adjustment', round(v_board_band_adjustment::numeric, 2),
    'board_ideal_wave_min_ft', v_board_ideal_min,
    'board_ideal_wave_max_ft', v_board_ideal_max
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.compute_user_match_score_core(uuid, uuid, text, text, text, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
