-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

-- Per-spot similarity scoring RPC.
-- ROLLBACK: DROP FUNCTION IF EXISTS public.compute_spot_similarity_score(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC);

CREATE OR REPLACE FUNCTION public.compute_spot_similarity_score(
  p_user_id       UUID,
  p_beach_id      UUID,
  p_wave_height   NUMERIC,
  p_wave_period   NUMERIC,
  p_wind_speed    NUMERIC,
  p_wind_direction NUMERIC DEFAULT NULL,
  p_tide_height   NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_session_count   INTEGER;
  v_avg_similarity  NUMERIC;
  v_score           NUMERIC;
  v_label           TEXT;
  v_match_percent   INTEGER;
  v_reason_bullets  JSONB;
  v_board_tip       TEXT;
  v_avg_rating      NUMERIC;
  v_matching_count  INTEGER;
  v_wh_bucket_label TEXT;
BEGIN
  IF p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied: can only query own similarity score';
  END IF;

  SELECT COUNT(*)
    INTO v_session_count
    FROM sessions s
    JOIN session_forecast_snapshots sfs ON sfs.session_id = s.id
   WHERE s.user_id    = p_user_id
     AND s.beach_id   = p_beach_id
     AND s.status     = 'completed'
     AND s.rating    >= 3
     AND s.arrival_time > NOW() - INTERVAL '12 months'
     AND s.deleted_at IS NULL
     AND sfs.forecast_snapshot IS NOT NULL;

  IF v_session_count < 5 THEN
    RETURN jsonb_build_object(
      'score',          0,
      'match_percent',  0,
      'label',          'Insufficient Data',
      'session_count',  v_session_count,
      'min_sessions',   5,
      'sessions_needed', 5 - v_session_count,
      'state',          'onboarding',
      'reason_bullets', jsonb_build_array(
        'Log ' || (5 - v_session_count)::TEXT
          || ' more rated sessions here to unlock your personal score'
      ),
      'board_tip',      NULL
    );
  END IF;

  WITH session_factors AS (
    SELECT
      s.id                                                          AS session_id,
      s.rating                                                      AS session_rating,
      s.board_id,
      (substring(sfs.forecast_snapshot->>'wave_height' FROM '[\d.]+'))::NUMERIC  AS snap_wh,
      (substring(sfs.forecast_snapshot->>'wave_period'  FROM '[\d.]+'))::NUMERIC AS snap_wp,
      (substring(sfs.forecast_snapshot->>'wind_speed'   FROM '[\d.]+'))::NUMERIC AS snap_ws,
      (substring(sfs.forecast_snapshot->>'wind_direction_deg' FROM '[\d.]+'))::NUMERIC AS snap_wd,
      (substring(sfs.forecast_snapshot->>'tide_height'  FROM '[\d.]+'))::NUMERIC AS snap_th
    FROM sessions s
    JOIN session_forecast_snapshots sfs ON sfs.session_id = s.id
    WHERE s.user_id    = p_user_id
      AND s.beach_id   = p_beach_id
      AND s.status     = 'completed'
      AND s.rating    >= 3
      AND s.arrival_time > NOW() - INTERVAL '12 months'
      AND s.deleted_at IS NULL
      AND sfs.forecast_snapshot IS NOT NULL
  ),
  bucket_scores AS (
    SELECT
      sf.session_id, sf.session_rating, sf.board_id,
      CASE
        WHEN p_wave_height IS NULL OR sf.snap_wh IS NULL THEN NULL
        WHEN (CASE WHEN p_wave_height < 2 THEN 0 WHEN p_wave_height < 4 THEN 1 WHEN p_wave_height < 6 THEN 2 WHEN p_wave_height < 8 THEN 3 ELSE 4 END)
           = (CASE WHEN sf.snap_wh < 2 THEN 0 WHEN sf.snap_wh < 4 THEN 1 WHEN sf.snap_wh < 6 THEN 2 WHEN sf.snap_wh < 8 THEN 3 ELSE 4 END) THEN 1.0
        WHEN ABS((CASE WHEN p_wave_height < 2 THEN 0 WHEN p_wave_height < 4 THEN 1 WHEN p_wave_height < 6 THEN 2 WHEN p_wave_height < 8 THEN 3 ELSE 4 END)
                - (CASE WHEN sf.snap_wh < 2 THEN 0 WHEN sf.snap_wh < 4 THEN 1 WHEN sf.snap_wh < 6 THEN 2 WHEN sf.snap_wh < 8 THEN 3 ELSE 4 END)) = 1 THEN 0.5
        ELSE 0.0
      END AS wh_sim,
      CASE
        WHEN p_wave_period IS NULL OR sf.snap_wp IS NULL THEN NULL
        WHEN (CASE WHEN p_wave_period < 8 THEN 0 WHEN p_wave_period < 12 THEN 1 WHEN p_wave_period < 16 THEN 2 ELSE 3 END)
           = (CASE WHEN sf.snap_wp < 8 THEN 0 WHEN sf.snap_wp < 12 THEN 1 WHEN sf.snap_wp < 16 THEN 2 ELSE 3 END) THEN 1.0
        WHEN ABS((CASE WHEN p_wave_period < 8 THEN 0 WHEN p_wave_period < 12 THEN 1 WHEN p_wave_period < 16 THEN 2 ELSE 3 END)
                - (CASE WHEN sf.snap_wp < 8 THEN 0 WHEN sf.snap_wp < 12 THEN 1 WHEN sf.snap_wp < 16 THEN 2 ELSE 3 END)) = 1 THEN 0.5
        ELSE 0.0
      END AS wp_sim,
      CASE
        WHEN p_wind_speed IS NULL OR sf.snap_ws IS NULL THEN NULL
        WHEN (CASE WHEN p_wind_speed < 5 THEN 0 WHEN p_wind_speed < 10 THEN 1 WHEN p_wind_speed < 15 THEN 2 ELSE 3 END)
           = (CASE WHEN sf.snap_ws < 5 THEN 0 WHEN sf.snap_ws < 10 THEN 1 WHEN sf.snap_ws < 15 THEN 2 ELSE 3 END) THEN 1.0
        WHEN ABS((CASE WHEN p_wind_speed < 5 THEN 0 WHEN p_wind_speed < 10 THEN 1 WHEN p_wind_speed < 15 THEN 2 ELSE 3 END)
                - (CASE WHEN sf.snap_ws < 5 THEN 0 WHEN sf.snap_ws < 10 THEN 1 WHEN sf.snap_ws < 15 THEN 2 ELSE 3 END)) = 1 THEN 0.5
        ELSE 0.0
      END AS ws_sim,
      CASE
        WHEN p_wind_direction IS NULL OR sf.snap_wd IS NULL THEN NULL
        WHEN LEAST(ABS(p_wind_direction - sf.snap_wd), 360.0 - ABS(p_wind_direction - sf.snap_wd)) <= 45 THEN 1.0
        WHEN LEAST(ABS(p_wind_direction - sf.snap_wd), 360.0 - ABS(p_wind_direction - sf.snap_wd)) <= 90 THEN 0.5
        ELSE 0.0
      END AS wd_sim,
      CASE
        WHEN p_tide_height IS NULL OR sf.snap_th IS NULL THEN NULL
        WHEN ABS(p_tide_height - sf.snap_th) <= 2.0 THEN 1.0
        WHEN ABS(p_tide_height - sf.snap_th) <= 4.0 THEN 0.5
        ELSE 0.0
      END AS th_sim
    FROM session_factors sf
  ),
  normalized AS (
    SELECT
      bs.session_id, bs.session_rating, bs.board_id,
      COALESCE(CASE WHEN bs.wh_sim IS NOT NULL THEN 0.35 END, 0)
        + COALESCE(CASE WHEN bs.wp_sim IS NOT NULL THEN 0.25 END, 0)
        + COALESCE(CASE WHEN bs.ws_sim IS NOT NULL THEN 0.20 END, 0)
        + COALESCE(CASE WHEN bs.wd_sim IS NOT NULL THEN 0.10 END, 0)
        + COALESCE(CASE WHEN bs.th_sim IS NOT NULL THEN 0.10 END, 0) AS avail_w,
      COALESCE(bs.wh_sim * 0.35, 0) + COALESCE(bs.wp_sim * 0.25, 0)
        + COALESCE(bs.ws_sim * 0.20, 0) + COALESCE(bs.wd_sim * 0.10, 0)
        + COALESCE(bs.th_sim * 0.10, 0) AS w_sum
    FROM bucket_scores bs
  ),
  with_similarity AS (
    SELECT n.session_id, n.session_rating, n.board_id,
      CASE WHEN n.avail_w > 0 THEN n.w_sum / n.avail_w ELSE 0 END AS similarity
    FROM normalized n
  ),
  top_matches AS (
    SELECT ws.session_id, ws.session_rating, ws.board_id, ws.similarity
    FROM with_similarity ws
    WHERE ws.similarity >= 0.60
    ORDER BY ws.similarity DESC LIMIT 5
  ),
  agg AS (
    SELECT COUNT(*)::INTEGER AS match_count,
      COALESCE(ROUND(AVG(tm.similarity), 4), 0) AS avg_sim,
      COALESCE(ROUND(AVG(tm.session_rating)::NUMERIC, 1), 0) AS avg_rat
    FROM top_matches tm
  ),
  board_freq AS (
    SELECT tm.board_id, COUNT(*) AS board_count
    FROM top_matches tm
    WHERE tm.board_id IS NOT NULL
    GROUP BY tm.board_id ORDER BY board_count DESC LIMIT 1
  )
  SELECT a.match_count, a.avg_sim, a.avg_rat,
    CASE
      WHEN bf.board_id IS NOT NULL AND a.match_count > 0
        AND (bf.board_count::NUMERIC / a.match_count) >= 0.60
      THEN 'You''ve used your ' || b.name || ' for '
           || ROUND((bf.board_count::NUMERIC / a.match_count) * 100)::TEXT
           || '% of similar sessions'
      ELSE NULL
    END
  INTO v_matching_count, v_avg_similarity, v_avg_rating, v_board_tip
  FROM agg a
  LEFT JOIN board_freq bf ON TRUE
  LEFT JOIN boards b ON b.id = bf.board_id;

  IF v_matching_count = 0 THEN
    RETURN jsonb_build_object(
      'score', 0.0, 'match_percent', 0, 'label', 'Low',
      'session_count', v_session_count, 'min_sessions', 5,
      'sessions_needed', 0, 'state', 'ready',
      'reason_bullets', jsonb_build_array(
        'These conditions are different from your past high-rated sessions',
        'Could be a good opportunity to try something new!'
      ),
      'board_tip', NULL
    );
  END IF;

  v_score := ROUND(v_avg_similarity * 10, 1);
  v_match_percent := ROUND(v_avg_similarity * 100)::INTEGER;
  v_label := CASE
    WHEN v_score >= 8.0 THEN 'Perfect'
    WHEN v_score >= 6.0 THEN 'Great'
    WHEN v_score >= 4.0 THEN 'Good'
    ELSE 'Low'
  END;

  v_wh_bucket_label := CASE
    WHEN p_wave_height IS NULL THEN NULL
    WHEN p_wave_height < 2  THEN '0-2'
    WHEN p_wave_height < 4  THEN '2-4'
    WHEN p_wave_height < 6  THEN '4-6'
    WHEN p_wave_height < 8  THEN '6-8'
    ELSE '8+'
  END;

  v_reason_bullets := jsonb_build_array(
    'You''ve surfed similar conditions with avg ' || v_avg_rating::TEXT || '/5 rating'
  );
  IF v_wh_bucket_label IS NOT NULL THEN
    v_reason_bullets := v_reason_bullets || jsonb_build_array(
      'Great sessions in ' || v_wh_bucket_label || ' ft waves'
    );
  END IF;
  v_reason_bullets := v_reason_bullets || jsonb_build_array(
    'These conditions match your surfing sweet spot'
  );

  RETURN jsonb_build_object(
    'score', v_score, 'match_percent', v_match_percent, 'label', v_label,
    'session_count', v_session_count, 'min_sessions', 5, 'sessions_needed', 0,
    'state', 'ready', 'reason_bullets', v_reason_bullets, 'board_tip', v_board_tip
  );
END;
$$;

COMMENT ON FUNCTION public.compute_spot_similarity_score(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) IS
  'Computes a 0-10 similarity score for current conditions at a specific beach relative to a user''s best past sessions there.';

GRANT EXECUTE ON FUNCTION public.compute_spot_similarity_score(UUID, UUID, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
