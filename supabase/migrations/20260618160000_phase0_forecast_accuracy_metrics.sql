BEGIN;

DO $$
BEGIN
  IF current_setting('app.phase0_forecast_accuracy_migration_approved', true)
    IS DISTINCT FROM '2026-06-19-phase0-forecast-accuracy-metrics-approved'
  THEN
    RAISE EXCEPTION
      'Phase 0 forecast accuracy migration requires explicit human approval. Set app.phase0_forecast_accuracy_migration_approved=2026-06-19-phase0-forecast-accuracy-metrics-approved in the same database session after approval.';
  END IF;
END $$;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS forecast_horizon_bucket text;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS display_wave_source text;

ALTER TABLE public.ml_predictions_log
  ADD COLUMN IF NOT EXISTS display_raw_input_height_m numeric(5,3);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ml_predictions_log_forecast_horizon_bucket_check'
      AND conrelid = 'public.ml_predictions_log'::regclass
  ) THEN
    ALTER TABLE public.ml_predictions_log
      ADD CONSTRAINT ml_predictions_log_forecast_horizon_bucket_check
      CHECK (
        forecast_horizon_bucket IS NULL
        OR forecast_horizon_bucket IN ('0-24h', '25-72h', '73h+')
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ml_predictions_log_display_wave_source_check'
      AND conrelid = 'public.ml_predictions_log'::regclass
  ) THEN
    ALTER TABLE public.ml_predictions_log
      ADD CONSTRAINT ml_predictions_log_display_wave_source_check
      CHECK (
        display_wave_source IS NULL
        OR display_wave_source IN (
          'cdip_sig',
          'model_swell',
          'cdip_swell',
          'model_hs',
          'ndbc_buoy',
          'nowcast_anchor'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ml_predictions_log_display_raw_input_height_nonnegative_check'
      AND conrelid = 'public.ml_predictions_log'::regclass
  ) THEN
    ALTER TABLE public.ml_predictions_log
      ADD CONSTRAINT ml_predictions_log_display_raw_input_height_nonnegative_check
      CHECK (
        display_raw_input_height_m IS NULL
        OR display_raw_input_height_m >= 0
      );
  END IF;
END $$;

COMMENT ON COLUMN public.ml_predictions_log.forecast_horizon_bucket IS
  'Canonical Phase 0 forecast lead-time bucket at snapshot issue time. Enables one frozen display snapshot per beach/forecast slot per 0-24h, 25-72h, and 73h+ horizon.';

COMMENT ON COLUMN public.ml_predictions_log.display_wave_source IS
  'Wave-height source tag used by the face-Hs transformer at snapshot issue time. Required for replaying proposed shoaling factors without applying CDIP-only calibration to model-derived heights.';

COMMENT ON COLUMN public.ml_predictions_log.display_raw_input_height_m IS
  'Raw height input in meters handed to the face-Hs transformer before shoaling, terrain, and display offset. Required for replaying proposed source-gated transforms.';

UPDATE public.ml_predictions_log
SET forecast_horizon_bucket = CASE
  WHEN forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
  WHEN forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
  WHEN forecast_horizon_hours >= 73 THEN '73h+'
  ELSE NULL
END
WHERE forecast_horizon_bucket IS NULL
  AND forecast_horizon_hours IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_predictions_display_horizon_source_unique
  ON public.ml_predictions_log (beach_id, predicted_at, forecast_horizon_bucket, display_source)
  NULLS NOT DISTINCT;

DROP INDEX IF EXISTS public.idx_ml_predictions_beach_predicted_at_unique;

CREATE INDEX IF NOT EXISTS idx_ml_predictions_horizon_bucket_observed
  ON public.ml_predictions_log (forecast_horizon_bucket, predicted_at DESC)
  WHERE observed_m > 0
    AND display_source = 'face-Hs-transformer-v1'
    AND forecast_horizon_bucket IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_forecast_accuracy_horizon_metrics(
  p_start timestamptz DEFAULT now() - interval '7 days',
  p_end timestamptz DEFAULT now()
)
RETURNS TABLE (
  horizon_bucket text,
  baseline text,
  sample_count bigint,
  mae_m numeric,
  bias_m numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH eligible AS (
    SELECT
      COALESCE(
        p.forecast_horizon_bucket,
        CASE
        WHEN p.forecast_horizon_hours BETWEEN 0 AND 24 THEN '0-24h'
        WHEN p.forecast_horizon_hours BETWEEN 25 AND 72 THEN '25-72h'
        WHEN p.forecast_horizon_hours >= 73 THEN '73h+'
        ELSE NULL
        END
      ) AS horizon_bucket,
      p.observed_m,
      p.raw_display_height_m,
      p.offset_corrected_display_height_m,
      p.wave_height_om,
      p.v5_shadow_height_m
    FROM public.ml_predictions_log p
    WHERE p.predicted_at >= p_start
      AND p.predicted_at < p_end
      AND p.observed_m > 0
      AND p.display_source = 'face-Hs-transformer-v1'
      AND (
        p.forecast_horizon_bucket IS NOT NULL
        OR p.forecast_horizon_hours IS NOT NULL
      )
  ),
  expanded AS (
    SELECT
      e.horizon_bucket,
      v.baseline,
      (v.predicted_m - e.observed_m) AS signed_error
    FROM eligible e
    CROSS JOIN LATERAL (
      VALUES
        ('current_display'::text, e.offset_corrected_display_height_m),
        ('raw_display'::text, e.raw_display_height_m),
        ('raw_om'::text, e.wave_height_om),
        ('v5_shadow'::text, e.v5_shadow_height_m)
    ) AS v(baseline, predicted_m)
    WHERE e.horizon_bucket IS NOT NULL
      AND v.predicted_m IS NOT NULL
      AND v.predicted_m >= 0
  )
  SELECT
    expanded.horizon_bucket,
    expanded.baseline,
    COUNT(*)::bigint AS sample_count,
    ROUND(AVG(ABS(expanded.signed_error))::numeric, 3) AS mae_m,
    ROUND(AVG(expanded.signed_error)::numeric, 3) AS bias_m
  FROM expanded
  GROUP BY expanded.horizon_bucket, expanded.baseline
  ORDER BY
    CASE expanded.horizon_bucket
      WHEN '0-24h' THEN 1
      WHEN '25-72h' THEN 2
      WHEN '73h+' THEN 3
      ELSE 4
    END,
    CASE expanded.baseline
      WHEN 'current_display' THEN 1
      WHEN 'raw_display' THEN 2
      WHEN 'raw_om' THEN 3
      WHEN 'v5_shadow' THEN 4
      ELSE 5
    END;
$$;

COMMENT ON FUNCTION public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz) IS
  'Phase 0 canonical face-height accuracy metric. Returns MAE and signed bias vs observed_m split by horizon bucket (0-24h, 25-72h, 73h+) and baseline (current display, raw display, raw OM, v5 shadow).';

REVOKE ALL ON FUNCTION public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_forecast_accuracy_horizon_metrics(timestamptz, timestamptz) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_ml_weekly_metrics()
RETURNS TABLE (
  model_version text,
  predictions bigint,
  with_ground_truth bigint,
  avg_raw_error_m numeric,
  avg_corrected_error_m numeric,
  avg_improvement_m numeric,
  pct_improved numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH weekly AS (
    SELECT
      p.model_version,
      p.observed_m,
      p.raw_display_height_m,
      p.offset_corrected_display_height_m,
      CASE
        WHEN p.observed_m > 0 AND p.raw_display_height_m IS NOT NULL
        THEN ABS(p.raw_display_height_m - p.observed_m)
        ELSE NULL
      END AS raw_display_error_m,
      CASE
        WHEN p.observed_m > 0 AND p.offset_corrected_display_height_m IS NOT NULL
        THEN ABS(p.offset_corrected_display_height_m - p.observed_m)
        ELSE NULL
      END AS current_display_error_m
    FROM public.ml_predictions_log p
    WHERE p.predicted_at > now() - interval '7 days'
      AND p.display_source = 'face-Hs-transformer-v1'
  )
  SELECT
    weekly.model_version,
    COUNT(*)::bigint AS predictions,
    COUNT(*) FILTER (WHERE weekly.observed_m > 0)::bigint AS with_ground_truth,
    ROUND(AVG(weekly.raw_display_error_m)::numeric, 3) AS avg_raw_error_m,
    ROUND(AVG(weekly.current_display_error_m)::numeric, 3) AS avg_corrected_error_m,
    ROUND(AVG(weekly.raw_display_error_m - weekly.current_display_error_m)::numeric, 3) AS avg_improvement_m,
    ROUND(
      100.0 * COUNT(*) FILTER (
        WHERE weekly.current_display_error_m < weekly.raw_display_error_m
      ) / NULLIF(
        COUNT(*) FILTER (
          WHERE weekly.current_display_error_m IS NOT NULL
            AND weekly.raw_display_error_m IS NOT NULL
        ),
        0
      ),
      1
    ) AS pct_improved
  FROM weekly
  GROUP BY weekly.model_version
  ORDER BY weekly.model_version DESC;
$$;

COMMENT ON FUNCTION public.get_ml_weekly_metrics() IS
  'Compatibility weekly metrics for scripts/ml-stats. Phase 0 repointed MAE from retired corrected_forecast_m/raw_error_m fields to live display snapshot columns vs observed_m.';

CREATE OR REPLACE FUNCTION public.get_ml_health_metrics()
RETURNS TABLE (
  total_predictions bigint,
  pending_observations bigint,
  pending_12_24h bigint,
  pending_gt_24h bigint,
  sentinel_marked bigint,
  matched_last_24h bigint,
  total_observable_24h bigint,
  match_rate_24h numeric,
  avg_raw_error_24h numeric,
  avg_corrected_error_24h numeric,
  improvement_pct_24h numeric,
  oldest_pending_age_hours numeric,
  observable_beaches_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < now() - interval '4 hours'
          AND p.predicted_at > now() - interval '7 days'
          AND ob.beach_id IS NOT NULL
      ) AS pending,
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < now() - interval '12 hours'
          AND p.predicted_at >= now() - interval '24 hours'
          AND ob.beach_id IS NOT NULL
      ) AS pending_12_24h,
      COUNT(*) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < now() - interval '24 hours'
          AND ob.beach_id IS NOT NULL
      ) AS pending_gt_24h,
      COUNT(*) FILTER (
        WHERE p.observed_m = -1
      ) AS sentinel,
      COUNT(*) FILTER (
        WHERE p.predicted_at > now() - interval '24 hours'
          AND p.predicted_at < now() - interval '4 hours'
          AND ob.beach_id IS NOT NULL
      ) AS total_24h,
      COUNT(*) FILTER (
        WHERE p.predicted_at > now() - interval '24 hours'
          AND p.observed_m > 0
          AND ob.beach_id IS NOT NULL
      ) AS matched_24h,
      AVG(ABS(p.raw_display_height_m - p.observed_m)) FILTER (
        WHERE p.predicted_at > now() - interval '24 hours'
          AND p.observed_m > 0
          AND p.raw_display_height_m IS NOT NULL
          AND ob.beach_id IS NOT NULL
      ) AS avg_raw_display_24h,
      AVG(ABS(p.offset_corrected_display_height_m - p.observed_m)) FILTER (
        WHERE p.predicted_at > now() - interval '24 hours'
          AND p.observed_m > 0
          AND p.offset_corrected_display_height_m IS NOT NULL
          AND ob.beach_id IS NOT NULL
      ) AS avg_current_display_24h,
      EXTRACT(EPOCH FROM (now() - MIN(p.predicted_at) FILTER (
        WHERE p.observed_m IS NULL
          AND p.predicted_at < now() - interval '4 hours'
          AND p.predicted_at > now() - interval '7 days'
          AND ob.beach_id IS NOT NULL
      ))) / 3600 AS oldest_pending_hours
    FROM public.ml_predictions_log p
    LEFT JOIN public.observable_beaches ob ON ob.beach_id = p.beach_id
    WHERE p.predicted_at > now() - interval '30 days'
      AND p.display_source = 'face-Hs-transformer-v1'
  ),
  beach_count AS (
    SELECT COUNT(*) AS cnt FROM public.observable_beaches
  )
  SELECT
    s.total::bigint,
    s.pending::bigint,
    s.pending_12_24h::bigint,
    s.pending_gt_24h::bigint,
    s.sentinel::bigint,
    s.matched_24h::bigint,
    s.total_24h::bigint,
    ROUND(100.0 * s.matched_24h / NULLIF(s.total_24h, 0), 1),
    ROUND(s.avg_raw_display_24h::numeric, 3),
    ROUND(s.avg_current_display_24h::numeric, 3),
    ROUND(
      100.0 * (s.avg_raw_display_24h - s.avg_current_display_24h) /
      NULLIF(s.avg_raw_display_24h, 0),
      1
    ),
    ROUND(s.oldest_pending_hours, 1),
    b.cnt::bigint
  FROM stats s, beach_count b;
END;
$$;

COMMENT ON FUNCTION public.get_ml_health_metrics() IS
  'Returns ML pipeline health metrics. Phase 0 repointed 24h MAE from retired raw/corrected error columns to live raw_display_height_m and offset_corrected_display_height_m vs observed_m.';

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
  'Stores user-logged sessions.wave_height_ft as weak observation candidates matched to the nearest face-Hs display ml_predictions_log.predicted_at within +/- 6 hours. Phase 0 tie-breaks same-slot snapshots toward the shortest forecast horizon. It snapshots model values for analytics and never updates ml_predictions_log.observed_m.';

REVOKE ALL ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
