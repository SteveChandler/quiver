BEGIN;

UPDATE public.user_xp
SET level = 9,
    updated_at = now()
WHERE level > 9;

ALTER TABLE public.user_xp DROP CONSTRAINT IF EXISTS user_xp_level_check;
ALTER TABLE public.user_xp
  ADD CONSTRAINT user_xp_level_check CHECK (level >= 1 AND level <= 9);

CREATE OR REPLACE FUNCTION public.increment_user_xp(
  p_user_id uuid,
  p_amount integer,
  p_action text,
  p_related_entity_id uuid DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (xp_total integer, level integer, awarded integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_total integer;
  v_level integer;
BEGIN
  IF p_user_id IS NULL OR p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'increment_user_xp: caller may only award XP to self';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'increment_user_xp: p_amount must be a positive integer';
  END IF;

  BEGIN
    INSERT INTO public.xp_events (user_id, action, related_entity_id, xp_amount, idempotency_key)
    VALUES (p_user_id, p_action, p_related_entity_id, p_amount, p_idempotency_key);
  EXCEPTION WHEN unique_violation THEN
    SELECT ux.xp_total, ux.level INTO v_total, v_level
    FROM public.user_xp ux WHERE ux.user_id = p_user_id;
    RETURN QUERY SELECT COALESCE(v_total, 0), COALESCE(v_level, 1), 0;
    RETURN;
  END;

  INSERT INTO public.user_xp (user_id, xp_total, level)
  VALUES (p_user_id, p_amount, 1)
  ON CONFLICT (user_id) DO UPDATE
    SET xp_total = public.user_xp.xp_total + EXCLUDED.xp_total,
        updated_at = now()
  RETURNING public.user_xp.xp_total INTO v_total;

  v_level := CASE
    WHEN v_total >= 4000 THEN 9
    WHEN v_total >= 3000 THEN 8
    WHEN v_total >= 2200 THEN 7
    WHEN v_total >= 1500 THEN 6
    WHEN v_total >= 1000 THEN 5
    WHEN v_total >= 600 THEN 4
    WHEN v_total >= 300 THEN 3
    WHEN v_total >= 100 THEN 2
    ELSE 1
  END;

  UPDATE public.user_xp SET level = v_level, updated_at = now() WHERE user_id = p_user_id;

  RETURN QUERY SELECT v_total, v_level, p_amount;
END;
$func$;

REVOKE ALL ON FUNCTION public.increment_user_xp(uuid, integer, text, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_user_xp(uuid, integer, text, uuid, text) TO authenticated;

COMMENT ON FUNCTION public.increment_user_xp(uuid, integer, text, uuid, text)
  IS 'Idempotent XP award (SECURITY DEFINER); sole write path for user_xp.xp_total. Returns (xp_total, level, awarded); awarded=0 on idempotent replay. Caps levels to the 9-tier product model.';

NOTIFY pgrst, 'reload schema';

COMMIT;
