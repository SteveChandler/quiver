-- Session size-vs-forecast answer for forecast-validation truth.
--
-- The native session log's FORECAST row asked Right / Kinda / Off (sessions.forecast_accuracy):
-- how wrong, never which way. It now asks how the surf compared with the height Quiver showed:
-- smaller / about_right / bigger. Every surfer compares against the same number, so personal
-- size scales cancel, and a forecast-prefilled height (about half of native logs) stops being
-- dead weight:
--   * prefill + about_right -> kept as an observation (it confirms the shown height);
--   * prefill + smaller/bigger -> the height stays rejected as forecast_prefilled_wave_height,
--     but the candidate keeps the direction;
--   * a typed height + an answer -> both are kept.
-- Native also starts writing sessions.forecast_wave_height_ft (the height the form showed) on
-- every log, and keeps writing forecast_accuracy (about_right -> accurate, otherwise inaccurate)
-- for older consumers.
--
-- Additive only: two nullable columns on sessions-side tables, the candidate sync, the snapshot
-- trigger's column list (so editing the answer re-syncs), and a size_vs_forecast block in
-- get_session_wave_observation_analytics(). No backfill: old forecast_accuracy answers mean
-- something else and stay their own cohort.
--
-- Apply BEFORE any native build that sends wave_size_vs_forecast (an unknown column fails the
-- insert). The transaction briefly holds ACCESS EXCLUSIVE on sessions and
-- session_wave_observation_candidates (ADD COLUMN, no rewrite) and SHARE ROW EXCLUSIVE on
-- sessions (trigger swap); seconds at most.
-- Rollback: see the end of this file.

BEGIN;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS wave_size_vs_forecast text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_wave_size_vs_forecast_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_wave_size_vs_forecast_check
      CHECK (wave_size_vs_forecast IN ('smaller', 'about_right', 'bigger')) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.sessions VALIDATE CONSTRAINT sessions_wave_size_vs_forecast_check;

COMMENT ON COLUMN public.sessions.wave_size_vs_forecast IS
  'The surfer''s answer to how the surf compared with the height Quiver showed (forecast_wave_height_ft): smaller, about_right or bigger. NULL = not asked or skipped.';

COMMENT ON COLUMN public.sessions.forecast_wave_height_ft IS
  'Face height in feet the log form showed for this beach and session time (the wave-chip prefill and the anchor of wave_size_vs_forecast). NULL when the form had no forecast.';

ALTER TABLE public.session_wave_observation_candidates
  ADD COLUMN IF NOT EXISTS reported_size_vs_forecast text,
  ADD COLUMN IF NOT EXISTS shown_forecast_height_ft numeric;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_wave_observation_candidates_size_vs_forecast_check'
      AND conrelid = 'public.session_wave_observation_candidates'::regclass
  ) THEN
    ALTER TABLE public.session_wave_observation_candidates
      ADD CONSTRAINT session_wave_observation_candidates_size_vs_forecast_check
      CHECK (reported_size_vs_forecast IN ('smaller', 'about_right', 'bigger')) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.session_wave_observation_candidates
  VALIDATE CONSTRAINT session_wave_observation_candidates_size_vs_forecast_check;

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

  observed_height_m := round((p_wave_height_ft * 0.3048)::numeric, 3);

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
    nearest_prediction.observed_m,
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

COMMENT ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) IS
  'Stores user-logged sessions.wave_height_ft as weak observation candidates matched to the nearest face-Hs display ml_predictions_log.predicted_at within +/- 6 hours. Phase 0 tie-breaks same-slot snapshots toward the shortest forecast horizon. Heights with sessions.wave_height_source = forecast_prefill are rejected as forecast_prefilled_wave_height unless the surfer answered wave_size_vs_forecast = about_right. Every candidate copies the size answer and the shown height. It snapshots model values for analytics and never updates ml_predictions_log.observed_m.';

-- 20261020233000 locked this to service_role; CREATE OR REPLACE keeps grants, restated here.
REVOKE ALL ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) TO service_role;

-- Same trigger, plus the two new columns so editing the answer or the shown height re-syncs.
DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON public.sessions;
CREATE TRIGGER trigger_create_session_forecast_snapshot
  AFTER INSERT OR UPDATE OF status, beach_id, wave_quality, water_temp, crowd_level, parking_ease,
    rating, notes, duration_minutes, arrival_time, wave_height_ft, wind_speed_mph, wind_direction,
    forecast_accuracy, tide_height_ft, tide_status, wave_size_vs_forecast, forecast_wave_height_ft
  ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_session_forecast_snapshot();

CREATE OR REPLACE FUNCTION public.get_session_wave_observation_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  analytics jsonb;
BEGIN
  WITH
    sessions_90d AS (
      SELECT
        s.id,
        s.user_id,
        s.deleted_at,
        p.analytics_is_real_user,
        p.is_mock,
        p.email
      FROM public.sessions s
      LEFT JOIN public.profiles p ON p.id = s.user_id
      WHERE s.wave_height_ft IS NOT NULL
        AND s.created_at >= now() - interval '90 days'
    ),
    real_completed_sessions AS (
      SELECT s.id
      FROM public.sessions s
      JOIN public.profiles p ON p.id = s.user_id
      WHERE s.status = 'completed'
        AND s.deleted_at IS NULL
        AND p.analytics_is_real_user = true
    ),
    candidates AS (
      SELECT c.*
      FROM public.session_wave_observation_candidates c
      JOIN public.profiles p ON p.id = c.user_id
      WHERE p.analytics_is_real_user = true
    ),
    comparable AS (
      SELECT
        c.*,
        abs(c.observed_m - c.snapshot_buoy_observed_m) AS user_abs_error_m,
        c.observed_m - c.snapshot_buoy_observed_m AS user_signed_error_m,
        CASE
          WHEN c.snapshot_display_height_m IS NULL THEN NULL
          ELSE abs(c.snapshot_display_height_m - c.snapshot_buoy_observed_m)
        END AS display_abs_error_m,
        CASE
          WHEN c.snapshot_raw_om_height_m IS NULL THEN NULL
          ELSE abs(c.snapshot_raw_om_height_m - c.snapshot_buoy_observed_m)
        END AS raw_om_abs_error_m,
        CASE
          WHEN c.snapshot_v5_shadow_height_m IS NULL THEN NULL
          ELSE abs(c.snapshot_v5_shadow_height_m - c.snapshot_buoy_observed_m)
        END AS v5_shadow_abs_error_m
      FROM candidates c
      WHERE c.quality_state <> 'rejected'
        AND c.observed_m IS NOT NULL
        AND c.snapshot_buoy_observed_m IS NOT NULL
        AND c.snapshot_buoy_observed_m > 0
    ),
    user_reliability_base AS (
      SELECT
        count(*) AS comparisons,
        round(avg(user_abs_error_m)::numeric, 3) AS avg_abs_error_m,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) AS median_abs_error_m,
        round((percentile_cont(0.75) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) AS p75_abs_error_m,
        round(avg(user_signed_error_m)::numeric, 3) AS avg_signed_bias_m
      FROM comparable
      GROUP BY user_id
    ),
    user_reliability AS (
      SELECT
        row_number() OVER (
          ORDER BY comparisons DESC, median_abs_error_m ASC
        ) AS anonymous_user_rank,
        comparisons,
        avg_abs_error_m,
        median_abs_error_m,
        p75_abs_error_m,
        avg_signed_bias_m
      FROM user_reliability_base
    ),
    beach_reliability AS (
      SELECT
        beach_id,
        count(*) AS comparisons,
        round(avg(user_abs_error_m)::numeric, 3) AS avg_abs_error_m,
        round((percentile_cont(0.5) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) AS median_abs_error_m
      FROM comparable
      GROUP BY beach_id
    ),
    delta_buckets AS (
      SELECT
        CASE
          WHEN nearest_prediction_delta_minutes IS NULL THEN 'no_ml_match'
          WHEN nearest_prediction_delta_minutes <= 30 THEN '0_30m'
          WHEN nearest_prediction_delta_minutes <= 90 THEN '31_90m'
          WHEN nearest_prediction_delta_minutes <= 180 THEN '91_180m'
          ELSE '181_360m'
        END AS bucket,
        count(*) AS candidates,
        count(*) FILTER (WHERE snapshot_buoy_observed_m IS NOT NULL AND snapshot_buoy_observed_m > 0) AS with_buoy_truth
      FROM candidates
      GROUP BY 1
    ),
    size_answers AS (
      -- Sessions whose size answer is usable: completed, with a beach and time. A
      -- rejected prefill still carries its direction.
      SELECT
        c.reported_size_vs_forecast,
        c.observed_at,
        c.shown_forecast_height_ft,
        c.reported_wave_height_ft,
        s.wave_height_source
      FROM candidates c
      JOIN public.sessions s ON s.id = c.session_id
      WHERE c.reported_size_vs_forecast IS NOT NULL
        AND s.deleted_at IS NULL
        AND (
          c.rejection_reason IS NULL
          OR c.rejection_reason IN (
            'no_matching_prediction',
            'forecast_prefilled_wave_height',
            'missing_wave_height_ft'
          )
        )
    )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'session_truth', jsonb_build_object(
      'wave_height_sessions_90d_raw', (SELECT count(*) FROM sessions_90d),
      'wave_height_sessions_90d_non_deleted', (
        SELECT count(*) FROM sessions_90d
        WHERE deleted_at IS NULL
      ),
      'wave_height_sessions_90d_strict_real', (
        SELECT count(*) FROM sessions_90d
        WHERE deleted_at IS NULL
          AND analytics_is_real_user = true
      ),
      'wave_height_sessions_90d_excluded_by_analytics_flag', (
        SELECT count(*) FROM sessions_90d
        WHERE deleted_at IS NULL
          AND analytics_is_real_user IS DISTINCT FROM true
      ),
      'wave_height_sessions_90d_mock_or_test_diagnostic', (
        SELECT count(*) FROM sessions_90d
        WHERE deleted_at IS NULL
          AND (
            is_mock = true
            OR email ILIKE '%test%'
            OR email LIKE '%@local.test'
            OR email LIKE '%@example.invalid'
          )
      ),
      'wave_height_sessions_90d_bot_flagged', (
        SELECT count(*)
        FROM sessions_90d s
        WHERE s.deleted_at IS NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_events e
            WHERE e.session_id = s.id
              AND e.bot_flagged = true
          )
      ),
      'wave_height_sessions_90d_snapshot_linked', (
        SELECT count(*)
        FROM sessions_90d s
        WHERE s.deleted_at IS NULL
          AND s.analytics_is_real_user = true
          AND EXISTS (
            SELECT 1
            FROM public.session_forecast_snapshots snap
            WHERE snap.session_id = s.id
          )
      )
    ),
    'funnel', jsonb_build_object(
      'real_completed_sessions', (SELECT count(*) FROM real_completed_sessions),
      'candidate_rows', (SELECT count(*) FROM candidates),
      'valid_height_candidates', (
        SELECT count(*)
        FROM candidates
        WHERE quality_state <> 'rejected'
          AND observed_m IS NOT NULL
          AND reported_wave_height_ft > 0
          AND reported_wave_height_ft <= 50
      ),
      'matched_to_ml_within_6h', (
        SELECT count(*)
        FROM candidates
        WHERE quality_state <> 'rejected'
          AND ml_prediction_id IS NOT NULL
      ),
      'matched_with_buoy_truth', (SELECT count(*) FROM comparable),
      'candidate_sessions_7d', (
        SELECT count(*)
        FROM candidates
        WHERE observed_at >= now() - interval '7 days'
      ),
      'candidate_sessions_30d', (
        SELECT count(*)
        FROM candidates
        WHERE observed_at >= now() - interval '30 days'
      )
    ),
    'quality', jsonb_build_object(
      'user_vs_buoy_abs_error_avg_m', (SELECT round(avg(user_abs_error_m)::numeric, 3) FROM comparable),
      'user_vs_buoy_abs_error_median_m', (SELECT round((percentile_cont(0.5) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) FROM comparable),
      'user_vs_buoy_abs_error_p75_m', (SELECT round((percentile_cont(0.75) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) FROM comparable),
      'user_vs_buoy_abs_error_p90_m', (SELECT round((percentile_cont(0.9) WITHIN GROUP (ORDER BY user_abs_error_m))::numeric, 3) FROM comparable),
      'user_vs_buoy_signed_bias_avg_m', (SELECT round(avg(user_signed_error_m)::numeric, 3) FROM comparable),
      'display_abs_error_avg_m', (SELECT round(avg(display_abs_error_m)::numeric, 3) FROM comparable WHERE display_abs_error_m IS NOT NULL),
      'raw_om_abs_error_avg_m', (SELECT round(avg(raw_om_abs_error_m)::numeric, 3) FROM comparable WHERE raw_om_abs_error_m IS NOT NULL),
      'v5_shadow_abs_error_avg_m', (SELECT round(avg(v5_shadow_abs_error_m)::numeric, 3) FROM comparable WHERE v5_shadow_abs_error_m IS NOT NULL),
      'user_beats_display_count', (SELECT count(*) FROM comparable WHERE display_abs_error_m IS NOT NULL AND user_abs_error_m < display_abs_error_m),
      'display_comparison_count', (SELECT count(*) FROM comparable WHERE display_abs_error_m IS NOT NULL),
      'user_beats_v5_shadow_count', (SELECT count(*) FROM comparable WHERE v5_shadow_abs_error_m IS NOT NULL AND user_abs_error_m < v5_shadow_abs_error_m),
      'v5_shadow_comparison_count', (SELECT count(*) FROM comparable WHERE v5_shadow_abs_error_m IS NOT NULL)
    ),
    'candidate_counts', jsonb_build_object(
      'by_quality_state', coalesce((
        SELECT jsonb_object_agg(quality_state, candidate_count)
        FROM (
          SELECT quality_state, count(*) AS candidate_count
          FROM candidates
          GROUP BY quality_state
        ) grouped
      ), '{}'::jsonb),
      'by_source_created_by', coalesce((
        SELECT jsonb_object_agg(source_created_by, candidate_count)
        FROM (
          SELECT source_created_by, count(*) AS candidate_count
          FROM candidates
          GROUP BY source_created_by
        ) grouped
      ), '{}'::jsonb),
      'effective_weak_label_mass', (
        SELECT coalesce(round(sum(observation_weight)::numeric, 3), 0)
        FROM candidates
        WHERE quality_state <> 'rejected'
          AND ml_prediction_id IS NOT NULL
      )
    ),
    'anonymous_user_reliability', coalesce((
      SELECT jsonb_agg(to_jsonb(user_reliability) ORDER BY anonymous_user_rank)
      FROM user_reliability
    ), '[]'::jsonb),
    'beach_reliability', coalesce((
      SELECT jsonb_agg(to_jsonb(beach_reliability) ORDER BY comparisons DESC, median_abs_error_m ASC)
      FROM beach_reliability
    ), '[]'::jsonb),
    'size_vs_forecast', jsonb_build_object(
      'answers', (SELECT count(*) FROM size_answers),
      'answers_30d', (
        SELECT count(*)
        FROM size_answers
        WHERE observed_at >= now() - interval '30 days'
      ),
      'by_answer', coalesce((
        SELECT jsonb_object_agg(reported_size_vs_forecast, answer_count)
        FROM (
          SELECT reported_size_vs_forecast, count(*) AS answer_count
          FROM size_answers
          GROUP BY reported_size_vs_forecast
        ) grouped
      ), '{}'::jsonb),
      'with_shown_height', (
        SELECT count(*)
        FROM size_answers
        WHERE shown_forecast_height_ft IS NOT NULL
      ),
      'confirmed_prefills', (
        SELECT count(*)
        FROM size_answers
        WHERE wave_height_source = 'forecast_prefill'
          AND reported_size_vs_forecast = 'about_right'
      ),
      'direction_only_prefills', (
        SELECT count(*)
        FROM size_answers
        WHERE wave_height_source = 'forecast_prefill'
          AND reported_size_vs_forecast <> 'about_right'
      ),
      -- A typed height more than half a foot on the other side of the shown height.
      'height_answer_conflicts', (
        SELECT count(*)
        FROM size_answers
        WHERE wave_height_source IS DISTINCT FROM 'forecast_prefill'
          AND shown_forecast_height_ft IS NOT NULL
          AND reported_wave_height_ft IS NOT NULL
          AND (
            (reported_size_vs_forecast = 'bigger'
              AND reported_wave_height_ft < shown_forecast_height_ft - 0.5)
            OR (reported_size_vs_forecast = 'smaller'
              AND reported_wave_height_ft > shown_forecast_height_ft + 0.5)
          )
      )
    ),
    'match_delta_buckets', coalesce((
      SELECT jsonb_agg(to_jsonb(delta_buckets) ORDER BY bucket)
      FROM delta_buckets
    ), '[]'::jsonb)
  ) INTO analytics;

  RETURN analytics;
END;
$$;

REVOKE ALL ON FUNCTION public.get_session_wave_observation_analytics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_session_wave_observation_analytics() TO service_role;

COMMIT;

-- Rollback (manual, after review):
-- BEGIN;
-- Re-run the get_session_wave_observation_analytics definition from
--   20260610001850_session_truth_cdip_station_preference.sql and the
--   sync_session_wave_observation_candidate definition from
--   20261019100000_session_wave_height_source.sql, then restate their service_role-only grants.
-- DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON public.sessions;
-- CREATE TRIGGER trigger_create_session_forecast_snapshot
--   AFTER INSERT OR UPDATE OF status, beach_id, wave_quality, water_temp, crowd_level, parking_ease,
--     rating, notes, duration_minutes, arrival_time, wave_height_ft, wind_speed_mph, wind_direction,
--     forecast_accuracy, tide_height_ft, tide_status
--   ON public.sessions FOR EACH ROW EXECUTE FUNCTION public.create_session_forecast_snapshot();
-- ALTER TABLE public.session_wave_observation_candidates
--   DROP CONSTRAINT IF EXISTS session_wave_observation_candidates_size_vs_forecast_check,
--   DROP COLUMN IF EXISTS reported_size_vs_forecast,
--   DROP COLUMN IF EXISTS shown_forecast_height_ft;
-- ALTER TABLE public.sessions
--   DROP CONSTRAINT IF EXISTS sessions_wave_size_vs_forecast_check,
--   DROP COLUMN IF EXISTS wave_size_vs_forecast;
-- COMMIT;
-- Roll back only after native stops sending wave_size_vs_forecast, or session saves fail.
