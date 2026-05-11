-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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
  v_sessions_needed integer;
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
    v_sessions_needed := 5 - v_session_count;
    RETURN jsonb_build_object(
      'state', 'onboarding',
      'session_count', v_session_count,
      'sessions_needed', v_sessions_needed
    );
  END IF;

  -- Ready branch populated in A5; stub returns a placeholder so ready-state tests in A4 fail loudly
  RETURN jsonb_build_object(
    'state', 'ready',
    'score', 0.0,
    'label', 'MEH',
    'reason_bullets', jsonb_build_array(),
    'board_tip', NULL,
    'confidence', 'low',
    'sessions_in_profile', v_session_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_user_match_score(uuid, uuid, text, text, text, text, text) TO authenticated;
