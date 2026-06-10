BEGIN;

-- Session truth pools default-deny to profiles.analytics_is_real_user = true.
-- Legacy mock/email heuristics remain diagnostic only so NULL analytics flags
-- cannot leak into weak-observation truth pools.
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
  'Returns aggregated weak session-wave observation analytics. Truth pools default-deny to profiles.analytics_is_real_user=true; session values remain weak diagnostics only.';

-- Station resolver epoch 2026-06-10: prefer explicit CDIP stations when the
-- configured station has recent wave observations. Historical observed_m
-- re-backfill is intentionally out of scope; downstream accuracy reporting
-- should treat this function replacement as a station resolver epoch.
CREATE OR REPLACE FUNCTION public.get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  -- Tier 0: explicit CDIP station override with recent usable wave observations.
  WITH preferred_cdip_station AS (
    SELECT
      'edu_ucsd_cdip_' || lpad(
        nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), ''),
        3,
        '0'
      ) AS station_id
    FROM public.beaches b
    WHERE b.id = p_beach_id
      AND b.cdip_station IS NOT NULL
      AND nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), '') IS NOT NULL
  )
  SELECT preferred_cdip_station.station_id INTO v_station_id
  FROM preferred_cdip_station
  WHERE EXISTS (
    SELECT 1
    FROM public.unified_wave_observations o
    WHERE o.station_id = preferred_cdip_station.station_id
      AND o.observed_at >= now() - interval '7 days'
      AND o.wave_height_m IS NOT NULL
      AND o.wave_height_m > 0
  )
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 1: IOOS station whose nearest_beach_id matches directly.
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 2: IOOS station within 25km with compatible swell (>= 30°).
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 3: NDBC direct station whose nearest_beach_id matches.
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
  ORDER BY s.distance_to_beach_km
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 4: NDBC direct station within 25km with compatible swell (>= 30°).
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_beach_observation_station(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_beach_observation_station(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_beach_observation_station(UUID) TO service_role;

COMMENT ON FUNCTION public.get_beach_observation_station(UUID) IS
  'Station resolver epoch 2026-06-10: prefer explicit beaches.cdip_station when recent CDIP wave observations exist, then preserve IOOS/NDBC fallback tiers. Historical observed_m re-backfill is intentionally out of scope.';

COMMIT;
