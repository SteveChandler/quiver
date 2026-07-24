-- Restore the former one-similarity-alert-per-user/day contract.
-- This rollback fails closed if the broader forward contract has already
-- admitted multiple similarity rows for one user and local alert date.

BEGIN;

LOCK TABLE public.alert_queue IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.alert_queue
    WHERE (conditions_snapshot ->> 'alert_type') = 'similarity_match'
    GROUP BY user_id, alert_date
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'rollback blocked: multiple similarity alerts exist for one user/day';
  END IF;
END;
$$;

CREATE UNIQUE INDEX alert_queue_one_similarity_per_user_day
  ON public.alert_queue (user_id, alert_date)
  WHERE (conditions_snapshot ->> 'alert_type') = 'similarity_match';

COMMENT ON INDEX public.alert_queue_one_similarity_per_user_day IS
  'Dedupe rail for similarity_match alert_queue rows: at most one per user and alert date.';

DROP INDEX IF EXISTS public.alert_queue_similarity_canonical_decision_dedupe;

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
BEGIN
  IF (p_conditions_snapshot ->> 'alert_type') IS DISTINCT FROM 'similarity_match' THEN
    RAISE EXCEPTION
      'try_insert_similarity_alert requires conditions_snapshot.alert_type = similarity_match (got: %)',
      coalesce(p_conditions_snapshot ->> 'alert_type', '<null>');
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
  ON CONFLICT (user_id, alert_date)
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
  'Idempotently queues at most one similarity alert per user and alert date.';

NOTIFY pgrst, 'reload schema';

COMMIT;
