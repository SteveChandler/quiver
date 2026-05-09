BEGIN;

CREATE OR REPLACE FUNCTION public.toggle_favorite_beach_guarded(p_beach_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existing_id uuid;
  v_favorite_count integer := 0;
  v_next_rank integer := 1;
  v_is_pro boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated'
      USING ERRCODE = '42501';
  END IF;

  IF p_beach_id IS NULL THEN
    RAISE EXCEPTION 'beach_id_required'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.beaches
    WHERE id = p_beach_id
  ) THEN
    RAISE EXCEPTION 'beach_not_found'
      USING ERRCODE = '23503';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  SELECT id
  INTO v_existing_id
  FROM public.favorite_beaches
  WHERE user_id = v_user_id
    AND beach_id = p_beach_id;

  IF v_existing_id IS NOT NULL THEN
    DELETE FROM public.favorite_beaches
    WHERE id = v_existing_id
      AND user_id = v_user_id;

    RETURN 'removed';
  END IF;

  SELECT
    COUNT(*)::integer,
    COALESCE(MAX(rank), 0) + 1
  INTO v_favorite_count, v_next_rank
  FROM public.favorite_beaches
  WHERE user_id = v_user_id;

  SELECT COALESCE(
    EXISTS (
      SELECT 1
      FROM public.user_entitlements ue
      WHERE ue.user_id = v_user_id
        AND (ue.is_pro = true OR ue.is_trialing = true)
        AND (
          ue.expires_at IS NULL
          OR ue.billing_issue = true
          OR ue.expires_at >= now()
        )
    ),
    false
  )
  INTO v_is_pro;

  IF NOT v_is_pro AND v_favorite_count >= 3 THEN
    RAISE EXCEPTION 'favorite_quota_exceeded'
      USING
        ERRCODE = 'P0001',
        DETAIL = 'free_favorites_limit',
        HINT = 'Upgrade to Pro for unlimited favorites.';
  END IF;

  INSERT INTO public.favorite_beaches (user_id, beach_id, rank)
  VALUES (v_user_id, p_beach_id, v_next_rank)
  ON CONFLICT (user_id, beach_id) DO NOTHING;

  RETURN 'added';
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_favorite_beach_guarded(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_favorite_beach_guarded(uuid) TO authenticated;

COMMENT ON FUNCTION public.toggle_favorite_beach_guarded(uuid) IS
  'Atomically toggles the authenticated user favorite for one beach and enforces the free plan 3-favorite cap using server-side user_entitlements.';

COMMIT;
