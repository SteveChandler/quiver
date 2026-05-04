BEGIN;

-- Bulk wrapper around compute_user_match_score. The single-slot RPC returns
-- jsonb with multiple possible shapes (state='onboarding' vs state='ready' vs
-- neutral fallback) — preserving the raw jsonb per slot keeps this wrapper
-- byte-for-byte equivalent to N independent single-slot calls. Performance
-- gain comes from collapsing N slot-round-trips to 1 per beach.
--
-- KNOWN LIMITATION: the loop body still re-invokes compute_user_match_score
-- for every slot, which means the user-session-profile CTEs (session_count,
-- positive preference, aversion preference, board_tip lookup) are rebuilt
-- on every slot AND on every candidate beach. Multi-beach callers (discovery,
-- the daily similarity cron) pay the profile-load cost N times.
--
-- A proper "bulk-multibeach" scorer (compute_user_match_score_multibeach)
-- that hoists session_count and per-break-type preference/aversion CTEs to
-- the top of the function and loops candidates × slots is deferred. Today's
-- call sites are bounded (≤20 candidate beaches per user) and the round-trip
-- win was the dominant cost; revisit when cron P95 wallclock or RPC count
-- grows. Track as a perf follow-up.
CREATE OR REPLACE FUNCTION compute_user_match_score_batch(
  p_user_id uuid,
  p_beach_id uuid,
  p_slots jsonb  -- array of { forecast_at, wave_height, wave_period, wind_speed, wind_direction, tide_height }
) RETURNS TABLE (
  slot_idx int,
  forecast_at timestamptz,
  result jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_slot jsonb;
  v_idx int := 0;
BEGIN
  IF p_slots IS NULL OR jsonb_typeof(p_slots) <> 'array' THEN
    RAISE EXCEPTION 'compute_user_match_score_batch: p_slots must be a jsonb array (got: %)',
      coalesce(jsonb_typeof(p_slots), '<null>');
  END IF;

  FOR v_slot IN SELECT * FROM jsonb_array_elements(p_slots)
  LOOP
    slot_idx := v_idx;
    forecast_at := (v_slot->>'forecast_at')::timestamptz;
    result := public.compute_user_match_score(
      p_user_id,
      p_beach_id,
      v_slot->>'wave_height',
      v_slot->>'wave_period',
      v_slot->>'wind_speed',
      v_slot->>'wind_direction',
      v_slot->>'tide_height'
    );
    RETURN NEXT;
    v_idx := v_idx + 1;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION compute_user_match_score_batch(uuid, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION compute_user_match_score_batch(uuid, uuid, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION compute_user_match_score_batch IS
  'Batched form of compute_user_match_score. Takes p_slots as a jsonb array of {forecast_at, wave_height, wave_period, wind_speed, wind_direction, tide_height} and returns one row per slot with (slot_idx, forecast_at, result). The result jsonb is the verbatim output of compute_user_match_score for that slot — preserving every possible shape (state=onboarding, state=ready, neutral fallback). Saves N-1 round-trips when scoring a forecast horizon.';

COMMIT;
