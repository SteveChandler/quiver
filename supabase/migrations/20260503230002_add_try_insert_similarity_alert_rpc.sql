BEGIN;

CREATE OR REPLACE FUNCTION try_insert_similarity_alert(
  p_user_id uuid,
  p_rule_id uuid,
  p_beach_id uuid,
  p_alert_date date,
  p_send_at timestamptz,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_best_hour timestamptz,
  p_conditions_snapshot jsonb
) RETURNS TABLE (
  inserted boolean,
  alert_queue_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Defensive: caller MUST stamp alert_type in conditions_snapshot. Reject any
  -- payload that doesn't or whose alert_type is wrong — we don't want this RPC
  -- inserting non-similarity rows under the dedupe index.
  IF (p_conditions_snapshot->>'alert_type') IS DISTINCT FROM 'similarity_match' THEN
    RAISE EXCEPTION 'try_insert_similarity_alert requires conditions_snapshot.alert_type = similarity_match (got: %)',
      coalesce(p_conditions_snapshot->>'alert_type', '<null>');
  END IF;

  -- ON CONFLICT inference targets the partial unique index
  -- alert_queue_one_similarity_per_user_day. Postgres requires the inference
  -- predicate to match the index's WHERE clause exactly.
  INSERT INTO alert_queue (
    user_id, rule_id, beach_id, alert_date, send_at,
    window_start, window_end, best_hour, conditions_snapshot, sent
  ) VALUES (
    p_user_id, p_rule_id, p_beach_id, p_alert_date, p_send_at,
    p_window_start, p_window_end, p_best_hour, p_conditions_snapshot, false
  )
  ON CONFLICT (user_id, alert_date)
    WHERE (conditions_snapshot->>'alert_type') = 'similarity_match'
    DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid;
  ELSE
    RETURN QUERY SELECT true, v_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION try_insert_similarity_alert(uuid, uuid, uuid, date, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION try_insert_similarity_alert(uuid, uuid, uuid, date, timestamptz, timestamptz, timestamptz, timestamptz, jsonb) TO service_role;

COMMENT ON FUNCTION try_insert_similarity_alert IS
  'Idempotent insert of a similarity_match alert_queue row. Returns inserted=true on success, inserted=false if the partial unique index alert_queue_one_similarity_per_user_day fired (already an alert for this user/date). Caller MUST stamp conditions_snapshot.alert_type=similarity_match.';

COMMIT;
