BEGIN;

CREATE OR REPLACE FUNCTION public.compute_implicit_preferences(target_user_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  processed_count integer := 0;
BEGIN
  RAISE NOTICE 'compute_implicit_preferences: starting (target_user_id=%)', target_user_id;

  INSERT INTO public.user_implicit_preferences (
    user_id,
    inferred_wave_min_ft,
    inferred_wave_max_ft,
    break_type_weights,
    location_centroid_lat,
    location_centroid_lon,
    top_engaged_beach_ids,
    confidence,
    event_count,
    last_computed_at,
    computed_from,
    computed_to
  )
  WITH
    weighted_events AS (
      SELECT
        e.user_id,
        e.beach_id,
        e.event_type,
        e.created_at,
        e.metadata,
        COALESCE(
          ((regexp_match(e.metadata->>'wave_height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'forecast_wave_height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'wave_height', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'waveHeight', '-?\d+(?:\.\d+)?'))[1])::numeric,
          ((regexp_match(e.metadata->>'height_ft', '-?\d+(?:\.\d+)?'))[1])::numeric
        ) AS metadata_wave_ft,
        CASE e.event_type
          WHEN 'location_update' THEN 10.0
          WHEN 'discovery_click' THEN 3.0
          WHEN 'forecast_check' THEN 2.5
          WHEN 'beach_view' THEN 0.5
          WHEN 'discovery_skip' THEN -1.0
          ELSE 0
        END AS weight,
        GREATEST(0, 1.0 - EXTRACT(EPOCH FROM (now() - e.created_at)) / (90 * 86400)) AS recency_factor
      FROM public.user_events e
      JOIN public.profiles p
        ON p.id = e.user_id
       AND p.allow_implicit_tracking = true
      WHERE e.user_id IS NOT NULL
        AND e.created_at > now() - interval '90 days'
        AND e.event_type IN (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
        AND (target_user_id IS NULL OR e.user_id = target_user_id)
    ),

    event_wave_samples AS (
      SELECT
        samples.user_id,
        samples.wave_height_ft
      FROM (
        SELECT
          we.user_id,
          COALESCE(we.metadata_wave_ft, forecast_wave.wave_height_ft) AS wave_height_ft
        FROM weighted_events we
        LEFT JOIN LATERAL (
          SELECT
            ((regexp_match(ef.wave_height::text, '-?\d+(?:\.\d+)?'))[1])::numeric AS wave_height_ft
          FROM public.enhanced_forecasts ef
          WHERE we.beach_id IS NOT NULL
            AND ef.beach_id = we.beach_id
            AND ef.forecast_at IS NOT NULL
            AND ef.forecast_at BETWEEN we.created_at - interval '6 hours'
                                  AND we.created_at + interval '6 hours'
          ORDER BY abs(EXTRACT(EPOCH FROM (ef.forecast_at - we.created_at))) ASC
          LIMIT 1
        ) forecast_wave ON true
        WHERE we.weight > 0
      ) samples
      WHERE samples.wave_height_ft BETWEEN 0 AND 50
    ),

    wave_ranges AS (
      SELECT
        user_id,
        CASE
          WHEN count(*) >= 3 THEN round((percentile_cont(0.1) WITHIN GROUP (ORDER BY wave_height_ft))::numeric, 1)
          ELSE NULL::numeric
        END AS inferred_wave_min_ft,
        CASE
          WHEN count(*) >= 3 THEN round((percentile_cont(0.9) WITHIN GROUP (ORDER BY wave_height_ft))::numeric, 1)
          ELSE NULL::numeric
        END AS inferred_wave_max_ft
      FROM event_wave_samples
      GROUP BY user_id
    ),

    user_metrics AS (
      SELECT
        we.user_id,
        count(*) AS event_count,
        min(we.created_at) AS computed_from,
        max(we.created_at) AS computed_to,
        sum(abs(we.weight)) AS total_abs_weight,
        array_agg(
          jsonb_build_object(
            'beach_id', we.beach_id,
            'lat', b.lat,
            'lon', b.lon,
            'break_type', b.break_type,
            'weighted_engagement', we.weight * we.recency_factor
          )
          ORDER BY (we.weight * we.recency_factor) DESC
        ) FILTER (WHERE we.beach_id IS NOT NULL) AS beach_data
      FROM weighted_events we
      LEFT JOIN public.beaches b ON we.beach_id = b.id
      GROUP BY we.user_id
      HAVING count(*) >= 3
    )

  SELECT
    um.user_id,
    wr.inferred_wave_min_ft,
    wr.inferred_wave_max_ft,
    coalesce(
      (
        SELECT jsonb_object_agg(break_type, round(weight_pct::numeric, 2))
        FROM (
          SELECT
            (beach_obj->>'break_type')::text AS break_type,
            sum((beach_obj->>'weighted_engagement')::numeric) /
              nullif(sum(sum((beach_obj->>'weighted_engagement')::numeric)) OVER (), 0) AS weight_pct
          FROM unnest(um.beach_data) AS beach_obj
          WHERE beach_obj->>'break_type' IS NOT NULL
            AND (beach_obj->>'weighted_engagement')::numeric > 0
          GROUP BY (beach_obj->>'break_type')::text
        ) bt
        WHERE weight_pct > 0
      ),
      '{}'::jsonb
    ),
    round(
      (
        SELECT sum((beach_obj->>'lat')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(CASE WHEN beach_obj->>'lat' IS NOT NULL
                               THEN (beach_obj->>'weighted_engagement')::numeric
                               ELSE 0 END), 0)
        FROM unnest(um.beach_data) AS beach_obj
        WHERE (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    round(
      (
        SELECT sum((beach_obj->>'lon')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(CASE WHEN beach_obj->>'lon' IS NOT NULL
                               THEN (beach_obj->>'weighted_engagement')::numeric
                               ELSE 0 END), 0)
        FROM unnest(um.beach_data) AS beach_obj
        WHERE (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    coalesce(
      (
        SELECT array_agg(beach_id ORDER BY weighted_engagement DESC)
        FROM (
          SELECT
            (beach_obj->>'beach_id')::uuid AS beach_id,
            sum((beach_obj->>'weighted_engagement')::numeric) AS weighted_engagement
          FROM unnest(um.beach_data) AS beach_obj
          WHERE (beach_obj->>'weighted_engagement')::numeric > 0
          GROUP BY (beach_obj->>'beach_id')::uuid
          ORDER BY weighted_engagement DESC
          LIMIT 5
        ) ranked
      ),
      ARRAY[]::uuid[]
    ),
    round(
      (1.0 / (1.0 + exp(-0.05 * (um.total_abs_weight - 20))))::numeric,
      2
    ),
    um.event_count::int,
    now(),
    um.computed_from,
    um.computed_to
  FROM user_metrics um
  LEFT JOIN wave_ranges wr ON wr.user_id = um.user_id
  ON CONFLICT (user_id) DO UPDATE SET
    inferred_wave_min_ft = excluded.inferred_wave_min_ft,
    inferred_wave_max_ft = excluded.inferred_wave_max_ft,
    break_type_weights = excluded.break_type_weights,
    location_centroid_lat = excluded.location_centroid_lat,
    location_centroid_lon = excluded.location_centroid_lon,
    top_engaged_beach_ids = excluded.top_engaged_beach_ids,
    confidence = excluded.confidence,
    event_count = excluded.event_count,
    last_computed_at = now(),
    computed_from = excluded.computed_from,
    computed_to = excluded.computed_to;

  GET DIAGNOSTICS processed_count = ROW_COUNT;

  DELETE FROM public.user_implicit_preferences prefs
  WHERE (target_user_id IS NULL OR prefs.user_id = target_user_id)
    AND NOT EXISTS (
      SELECT 1
      FROM public.user_events e
      JOIN public.profiles p
        ON p.id = e.user_id
       AND p.allow_implicit_tracking = true
      WHERE e.user_id = prefs.user_id
        AND e.created_at > now() - interval '90 days'
        AND e.event_type IN (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
      GROUP BY e.user_id
      HAVING count(*) >= 3
    );

  RAISE NOTICE 'compute_implicit_preferences: completed (processed_count=%)', processed_count;

  RETURN processed_count;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'compute_implicit_preferences: error - % (%)', sqlerrm, sqlstate;
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.compute_implicit_preferences(uuid) IS
  'Computes implicit preferences from opted-in user_events with weighted decay. Wave range is inferred from positive implicit event metadata first, then nearest enhanced_forecasts.forecast_at within +/- 6 hours. Pass NULL for batch processing all users, or user_id for single-user update.';

CREATE TABLE IF NOT EXISTS public.session_wave_observation_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  user_id uuid,
  beach_id uuid,
  ml_prediction_id uuid REFERENCES public.ml_predictions_log(id) ON DELETE SET NULL,
  observed_at timestamptz,
  reported_wave_height_ft numeric,
  observed_m numeric,
  nearest_prediction_delta_minutes numeric,
  observation_source text NOT NULL DEFAULT 'user_session',
  quality_state text NOT NULL DEFAULT 'weak',
  rejection_reason text,
  observation_weight numeric NOT NULL DEFAULT 0.2,
  source_created_by text NOT NULL DEFAULT 'trigger',
  matched_prediction_at timestamptz,
  snapshot_display_height_m numeric,
  snapshot_raw_om_height_m numeric,
  snapshot_v5_shadow_height_m numeric,
  snapshot_buoy_observed_m numeric,
  snapshot_raw_forecast_m numeric,
  snapshot_corrected_forecast_m numeric,
  snapshot_model_version text,
  snapshot_v5_model_version text,
  snapshot_candidate_model_version text,
  snapshot_display_source text,
  forecast_horizon_hours integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_wave_observation_candidates_session_unique UNIQUE (session_id),
  CONSTRAINT session_wave_observation_candidates_source_check
    CHECK (observation_source IN ('user_session')),
  CONSTRAINT session_wave_observation_candidates_quality_check
    CHECK (quality_state IN ('weak', 'calibrated_user', 'consensus', 'rejected')),
  CONSTRAINT session_wave_observation_candidates_weight_check
    CHECK (observation_weight >= 0 AND observation_weight <= 1),
  CONSTRAINT session_wave_observation_candidates_created_by_check
    CHECK (source_created_by IN ('trigger', 'backfill'))
);

CREATE INDEX IF NOT EXISTS idx_session_wave_obs_candidates_user
  ON public.session_wave_observation_candidates(user_id);

CREATE INDEX IF NOT EXISTS idx_session_wave_obs_candidates_beach_observed
  ON public.session_wave_observation_candidates(beach_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_wave_obs_candidates_ml_prediction
  ON public.session_wave_observation_candidates(ml_prediction_id)
  WHERE ml_prediction_id IS NOT NULL;

ALTER TABLE public.session_wave_observation_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages session wave observation candidates"
  ON public.session_wave_observation_candidates;

CREATE POLICY "Service role manages session wave observation candidates"
  ON public.session_wave_observation_candidates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.session_wave_observation_candidates IS
  'Weak user-session wave-height observations for analytics and future reviewed ML experiments. These rows never update ml_predictions_log.observed_m.';

COMMENT ON COLUMN public.session_wave_observation_candidates.observation_weight IS
  'Informational weak-label weight. Current ML training, gates, offsets, drift checks, and accuracy metrics do not consume this table.';

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
BEGIN
  IF p_session_id IS NULL THEN
    RETURN NULL;
  END IF;

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
      forecast_horizon_hours
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
      NULL
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
      updated_at = now()
    RETURNING id INTO candidate_id;

    RETURN candidate_id;
  END IF;

  observed_height_m := round((p_wave_height_ft * 0.3048)::numeric, 3);

  SELECT p.*
  INTO nearest_prediction
  FROM public.ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.predicted_at IS NOT NULL
    AND p.predicted_at BETWEEN p_arrival_time - interval '6 hours'
                           AND p_arrival_time + interval '6 hours'
  ORDER BY abs(EXTRACT(EPOCH FROM (p.predicted_at - p_arrival_time))) ASC
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
    forecast_horizon_hours
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
    nearest_prediction.forecast_horizon_hours
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
    updated_at = now()
  RETURNING id INTO candidate_id;

  RETURN candidate_id;
END;
$$;

COMMENT ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) IS
  'Stores user-logged sessions.wave_height_ft as weak observation candidates matched to the nearest ml_predictions_log.predicted_at within +/- 6 hours. It snapshots model values for analytics and never updates ml_predictions_log.observed_m.';

REVOKE ALL ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) FROM PUBLIC, anon, authenticated;

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
    real_completed_sessions AS (
      SELECT s.id
      FROM public.sessions s
      JOIN public.profiles p ON p.id = s.user_id
      WHERE s.status = 'completed'
        AND s.deleted_at IS NULL
        AND p.is_mock = false
        AND (
          p.email IS NULL
          OR (
            p.email NOT ILIKE '%test%'
            AND p.email NOT LIKE '%@local.test'
            AND p.email NOT LIKE '%@example.invalid'
          )
        )
    ),
    candidates AS (
      SELECT c.*
      FROM public.session_wave_observation_candidates c
      JOIN public.profiles p ON p.id = c.user_id
      WHERE p.is_mock = false
        AND (
          p.email IS NULL
          OR (
            p.email NOT ILIKE '%test%'
            AND p.email NOT LIKE '%@local.test'
            AND p.email NOT LIKE '%@example.invalid'
          )
        )
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
    )
  SELECT jsonb_build_object(
    'generated_at', now(),
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

COMMENT ON FUNCTION public.get_session_wave_observation_analytics() IS
  'Returns aggregated weak session-wave observation analytics without user emails or raw user identifiers. Used by private ML/app-stats reporting only.';

SELECT public.sync_session_wave_observation_candidate(
  s.id,
  s.user_id,
  s.beach_id::uuid,
  s.arrival_time,
  s.status,
  s.wave_height_ft,
  'backfill'
)
FROM public.sessions s
WHERE s.status = 'completed'
  AND s.deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.create_session_forecast_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  forecast_data jsonb;
  conditions_data jsonb;
  forecast_vs_actual_data jsonb := '{}'::jsonb;
  snapshot_exists boolean;
  should_rematch_forecast boolean := false;
  forecast_wave_height numeric;
  forecast_wind_speed numeric;
  forecast_tide_height numeric;
BEGIN
  PERFORM public.sync_session_wave_observation_candidate(
    new.id,
    new.user_id,
    new.beach_id::uuid,
    new.arrival_time,
    new.status,
    new.wave_height_ft,
    'trigger'
  );

  IF new.status IS DISTINCT FROM 'completed' THEN
    RETURN new;
  END IF;

  conditions_data := jsonb_build_object(
    'wave_quality', new.wave_quality,
    'water_temp', new.water_temp,
    'crowd_level', new.crowd_level,
    'parking_ease', new.parking_ease,
    'rating', new.rating,
    'notes', new.notes,
    'duration_minutes', new.duration_minutes,
    'arrival_time', new.arrival_time,
    'wave_height_ft', new.wave_height_ft,
    'wind_speed_mph', new.wind_speed_mph,
    'wind_direction', new.wind_direction,
    'forecast_accuracy', new.forecast_accuracy,
    'tide_height_ft', new.tide_height_ft,
    'tide_status', new.tide_status
  );

  IF tg_op = 'UPDATE' THEN
    should_rematch_forecast :=
      old.status = 'completed'
      AND (
        old.arrival_time IS DISTINCT FROM new.arrival_time
        OR old.beach_id IS DISTINCT FROM new.beach_id
      );
  END IF;

  IF tg_op = 'UPDATE' THEN
    IF old.status = 'completed' THEN
      SELECT sfs.forecast_snapshot
      INTO forecast_data
      FROM public.session_forecast_snapshots sfs
      WHERE sfs.session_id = new.id;

      IF forecast_data IS NOT NULL AND NOT should_rematch_forecast THEN
        IF forecast_data->>'wave_height' IS NOT NULL AND new.wave_height_ft IS NOT NULL THEN
          BEGIN
            forecast_wave_height := (forecast_data->>'wave_height')::numeric;
            IF forecast_wave_height IS DISTINCT FROM new.wave_height_ft THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wave_height_ft', jsonb_build_object(
                  'forecast', forecast_wave_height,
                  'actual', new.wave_height_ft,
                  'diff', new.wave_height_ft - forecast_wave_height
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'wind_speed_mph' IS NOT NULL AND new.wind_speed_mph IS NOT NULL THEN
          BEGIN
            forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
            IF forecast_wind_speed IS DISTINCT FROM new.wind_speed_mph THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wind_speed_mph', jsonb_build_object(
                  'forecast', forecast_wind_speed,
                  'actual', new.wind_speed_mph,
                  'diff', new.wind_speed_mph - forecast_wind_speed
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'wind_direction' IS NOT NULL AND new.wind_direction IS NOT NULL THEN
          IF forecast_data->>'wind_direction' <> new.wind_direction THEN
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'wind_direction', jsonb_build_object(
                'forecast', forecast_data->>'wind_direction',
                'actual', new.wind_direction
              )
            );
          END IF;
        END IF;

        IF forecast_data->>'tide_height' IS NOT NULL AND new.tide_height_ft IS NOT NULL THEN
          BEGIN
            forecast_tide_height := (forecast_data->>'tide_height')::numeric;
            IF forecast_tide_height IS DISTINCT FROM new.tide_height_ft THEN
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'tide_height_ft', jsonb_build_object(
                  'forecast', forecast_tide_height,
                  'actual', new.tide_height_ft,
                  'diff', new.tide_height_ft - forecast_tide_height
                )
              );
            END IF;
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;

        IF forecast_data->>'tide_status' IS NOT NULL AND new.tide_status IS NOT NULL THEN
          IF forecast_data->>'tide_status' <> new.tide_status THEN
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'tide_status', jsonb_build_object(
                'forecast', forecast_data->>'tide_status',
                'actual', new.tide_status
              )
            );
          END IF;
        END IF;

        UPDATE public.session_forecast_snapshots
        SET
          actual_conditions = coalesce(actual_conditions, '{}'::jsonb) || conditions_data,
          forecast_vs_actual = forecast_vs_actual_data,
          session_date = new.arrival_time::date,
          updated_at = now()
        WHERE session_id = new.id;

        RETURN new;
      END IF;
    END IF;
  END IF;

  SELECT exists(
    SELECT 1
    FROM public.session_forecast_snapshots
    WHERE session_id = new.id
  ) INTO snapshot_exists;

  IF snapshot_exists AND NOT should_rematch_forecast THEN
    RETURN new;
  END IF;

  SELECT to_jsonb(ef.*)
  INTO forecast_data
  FROM public.enhanced_forecasts ef
  WHERE ef.beach_id::uuid = new.beach_id::uuid
    AND ef.forecast_at IS NOT NULL
    AND ef.forecast_at BETWEEN new.arrival_time - interval '6 hours'
                          AND new.arrival_time + interval '6 hours'
  ORDER BY abs(EXTRACT(EPOCH FROM (ef.forecast_at - new.arrival_time))) ASC
  LIMIT 1;

  IF forecast_data IS NOT NULL THEN
    forecast_vs_actual_data := '{}'::jsonb;

    IF forecast_data->>'wave_height' IS NOT NULL AND new.wave_height_ft IS NOT NULL THEN
      BEGIN
        forecast_wave_height := (forecast_data->>'wave_height')::numeric;
        IF forecast_wave_height IS DISTINCT FROM new.wave_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wave_height_ft', jsonb_build_object(
              'forecast', forecast_wave_height,
              'actual', new.wave_height_ft,
              'diff', new.wave_height_ft - forecast_wave_height
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'wind_speed_mph' IS NOT NULL AND new.wind_speed_mph IS NOT NULL THEN
      BEGIN
        forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
        IF forecast_wind_speed IS DISTINCT FROM new.wind_speed_mph THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wind_speed_mph', jsonb_build_object(
              'forecast', forecast_wind_speed,
              'actual', new.wind_speed_mph,
              'diff', new.wind_speed_mph - forecast_wind_speed
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'wind_direction' IS NOT NULL AND new.wind_direction IS NOT NULL THEN
      IF forecast_data->>'wind_direction' <> new.wind_direction THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'wind_direction', jsonb_build_object(
            'forecast', forecast_data->>'wind_direction',
            'actual', new.wind_direction
          )
        );
      END IF;
    END IF;

    IF forecast_data->>'tide_height' IS NOT NULL AND new.tide_height_ft IS NOT NULL THEN
      BEGIN
        forecast_tide_height := (forecast_data->>'tide_height')::numeric;
        IF forecast_tide_height IS DISTINCT FROM new.tide_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'tide_height_ft', jsonb_build_object(
              'forecast', forecast_tide_height,
              'actual', new.tide_height_ft,
              'diff', new.tide_height_ft - forecast_tide_height
            )
          );
        END IF;
      EXCEPTION WHEN others THEN NULL;
      END;
    END IF;

    IF forecast_data->>'tide_status' IS NOT NULL AND new.tide_status IS NOT NULL THEN
      IF forecast_data->>'tide_status' <> new.tide_status THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'tide_status', jsonb_build_object(
            'forecast', forecast_data->>'tide_status',
            'actual', new.tide_status
          )
        );
      END IF;
    END IF;

    IF snapshot_exists THEN
      UPDATE public.session_forecast_snapshots
      SET
        beach_id = new.beach_id::uuid,
        forecast_snapshot = forecast_data,
        actual_conditions = coalesce(actual_conditions, '{}'::jsonb) || conditions_data,
        forecast_vs_actual = forecast_vs_actual_data,
        forecast_confidence_score = (forecast_data->>'confidence_score')::integer,
        data_source = forecast_data->>'data_source',
        session_date = new.arrival_time::date,
        updated_at = now()
      WHERE session_id = new.id;
    ELSE
      BEGIN
        INSERT INTO public.session_forecast_snapshots (
          session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
          forecast_vs_actual, forecast_confidence_score, data_source, session_date
        ) VALUES (
          new.id, new.user_id, new.beach_id::uuid, forecast_data, conditions_data,
          forecast_vs_actual_data, (forecast_data->>'confidence_score')::integer,
          forecast_data->>'data_source', new.arrival_time::date
        );
      EXCEPTION
        WHEN unique_violation THEN NULL;
        WHEN others THEN RAISE WARNING 'Failed to create forecast snapshot for session %: %', new.id, sqlerrm;
      END;
    END IF;
  ELSIF snapshot_exists AND should_rematch_forecast THEN
    DELETE FROM public.session_forecast_snapshots
    WHERE session_id = new.id;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON public.sessions;

CREATE TRIGGER trigger_create_session_forecast_snapshot
  AFTER INSERT OR UPDATE OF
    status, beach_id, wave_quality, water_temp, crowd_level, parking_ease, rating, notes,
    duration_minutes, arrival_time, wave_height_ft, wind_speed_mph, wind_direction,
    forecast_accuracy, tide_height_ft, tide_status
  ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.create_session_forecast_snapshot();

COMMENT ON FUNCTION public.create_session_forecast_snapshot() IS
  'Creates session forecast snapshots and keeps actual_conditions synced. Forecast rows are matched by nearest enhanced_forecasts.forecast_at within +/- 6 hours of session arrival_time.';

REVOKE ALL ON FUNCTION public.create_session_forecast_snapshot() FROM PUBLIC, anon, authenticated;

COMMIT;
