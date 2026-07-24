-- Align similarity alert queue deduplication with the canonical Surf Call:
-- the same user, beach, forecast window, and verdict may be queued only once.
-- Treat snapshots from the currently deployed legacy producer, which omit
-- session_decision, as "go" until that producer is replaced.
-- The previous user/day index was stricter, so existing rows cannot conflict
-- with this broader composite key when the replacement index is created.

BEGIN;

LOCK TABLE public.alert_queue IN SHARE ROW EXCLUSIVE MODE;

CREATE UNIQUE INDEX alert_queue_similarity_canonical_decision_dedupe
  ON public.alert_queue (
    user_id,
    beach_id,
    window_start,
    (
      CASE
        WHEN conditions_snapshot ? 'session_decision'
          THEN conditions_snapshot -> 'session_decision' ->> 'verdict'
        ELSE 'go'
      END
    )
  )
  WHERE (conditions_snapshot ->> 'alert_type') = 'similarity_match';

COMMENT ON INDEX public.alert_queue_similarity_canonical_decision_dedupe IS
  'Deduplicates similarity alerts by user, beach, forecast window, and canonical session verdict; legacy missing verdicts are treated as go.';

DROP INDEX IF EXISTS public.alert_queue_one_similarity_per_user_day;

CREATE OR REPLACE FUNCTION public.try_insert_similarity_alert(
  p_user_id uuid,
  p_rule_id uuid,
  p_beach_id uuid,
  p_alert_date date,
  p_send_at timestamptz,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_best_hour timestamptz,
  p_conditions_snapshot jsonb
)
RETURNS TABLE (inserted boolean, alert_queue_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_verdict text;
BEGIN
  IF (p_conditions_snapshot ->> 'alert_type') IS DISTINCT FROM 'similarity_match' THEN
    RAISE EXCEPTION
      'try_insert_similarity_alert requires conditions_snapshot.alert_type = similarity_match (got: %)',
      coalesce(p_conditions_snapshot ->> 'alert_type', '<null>');
  END IF;

  v_verdict := CASE
    WHEN p_conditions_snapshot ? 'session_decision'
      THEN p_conditions_snapshot -> 'session_decision' ->> 'verdict'
    ELSE 'go'
  END;
  IF v_verdict IS NULL OR v_verdict NOT IN ('go', 'maybe', 'no') THEN
    RAISE EXCEPTION
      'try_insert_similarity_alert requires a canonical session_decision.verdict (got: %)',
      coalesce(v_verdict, '<null>');
  END IF;

  INSERT INTO public.alert_queue (
    user_id,
    rule_id,
    beach_id,
    alert_date,
    send_at,
    window_start,
    window_end,
    best_hour,
    conditions_snapshot,
    sent
  ) VALUES (
    p_user_id,
    p_rule_id,
    p_beach_id,
    p_alert_date,
    p_send_at,
    p_window_start,
    p_window_end,
    p_best_hour,
    p_conditions_snapshot,
    false
  )
  ON CONFLICT (
    user_id,
    beach_id,
    window_start,
    (
      CASE
        WHEN conditions_snapshot ? 'session_decision'
          THEN conditions_snapshot -> 'session_decision' ->> 'verdict'
        ELSE 'go'
      END
    )
  )
  WHERE (conditions_snapshot ->> 'alert_type') = 'similarity_match'
  DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::uuid;
  ELSE
    RETURN QUERY SELECT true, v_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.try_insert_similarity_alert(
  uuid,
  uuid,
  uuid,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.try_insert_similarity_alert(
  uuid,
  uuid,
  uuid,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb
) TO service_role;

COMMENT ON FUNCTION public.try_insert_similarity_alert(
  uuid,
  uuid,
  uuid,
  date,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  jsonb
) IS
  'Idempotently queues a similarity alert by user, beach, window, and canonical verdict; legacy missing verdicts are treated as go.';

NOTIFY pgrst, 'reload schema';

COMMIT;
