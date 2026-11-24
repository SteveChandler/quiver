-- Founding surfer access: one runtime switch that gives signed-in free users
-- Pro feature gates. Ships OFF; the seed row changes nothing until a reviewed
-- production update flips it (see docs/2026-11-04-founding-surfer-access.md).
--
-- Each replaced function starts from its latest definition (verified against
-- production with pg_get_functiondef on 2026-11-04) and changes only the
-- entitlement check. CREATE OR REPLACE keeps the existing grants, owner,
-- SECURITY mode and search_path.
--
-- Rollback: set the switch to false (every gate returns to today's behavior),
-- or re-apply the previous definitions from 20260821150000, 20260923040000,
-- 20260902093602 and 20260923041000, then drop founding_access_enabled() and
-- app_runtime_flags.

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_runtime_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  note text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_runtime_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.app_runtime_flags FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.app_runtime_flags TO service_role;

INSERT INTO public.app_runtime_flags (key, enabled, note)
VALUES (
  'founding_access',
  false,
  'Founding surfer access: signed-in non-Pro users get Pro feature gates. Production flips need Steven''s approval.'
)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.founding_access_enabled()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT enabled FROM public.app_runtime_flags WHERE key = 'founding_access'),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.founding_access_enabled() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.founding_access_enabled() TO authenticated, service_role;

COMMENT ON FUNCTION public.founding_access_enabled() IS
  'True while the founding_access runtime switch is on. Missing row reads as off.';

-- Curated-beach favorites cap (3).
CREATE OR REPLACE FUNCTION public.toggle_favorite_spot_guarded(
  p_beach_id uuid DEFAULT NULL,
  p_custom_spot_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_id uuid;
  favorite_count integer;
  next_rank integer;
  has_unlimited_favorites boolean;
  has_billing_issue boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF (p_beach_id IS NULL) = (p_custom_spot_id IS NULL) THEN
    RAISE EXCEPTION 'invalid_favorite_target'
      USING DETAIL = 'exactly_one_target_required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(current_user_id::text)::bigint);

  IF p_custom_spot_id IS NOT NULL THEN
    PERFORM 1
    FROM public.custom_spots cs
    WHERE cs.id = p_custom_spot_id
      AND cs.user_id = current_user_id
      AND cs.deleted_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'custom_spot_not_found'
        USING DETAIL = 'custom_spot_not_owned_or_deleted';
    END IF;

    SELECT id INTO existing_id
    FROM public.favorite_beaches
    WHERE user_id = current_user_id
      AND custom_spot_id = p_custom_spot_id
    LIMIT 1;
  ELSE
    SELECT id INTO existing_id
    FROM public.favorite_beaches
    WHERE user_id = current_user_id
      AND beach_id = p_beach_id
    LIMIT 1;
  END IF;

  IF existing_id IS NOT NULL THEN
    DELETE FROM public.favorite_beaches
    WHERE id = existing_id
      AND user_id = current_user_id;
    RETURN 'removed';
  END IF;

  IF p_custom_spot_id IS NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.user_entitlements ue
      WHERE ue.user_id = current_user_id
        AND (ue.is_pro = true OR ue.is_trialing = true)
        AND (
          ue.expires_at IS NULL
          OR ue.expires_at > now()
          OR ue.billing_issue = true
        )
    ) INTO has_unlimited_favorites;

    SELECT EXISTS (
      SELECT 1
      FROM public.user_entitlements ue
      WHERE ue.user_id = current_user_id
        AND ue.billing_issue = true
    ) INTO has_billing_issue;

    SELECT count(*) INTO favorite_count
    FROM public.favorite_beaches fb
    WHERE fb.user_id = current_user_id
      AND fb.beach_id IS NOT NULL;

    -- Founding access lifts the cap while the switch is on; saved rows stay when it goes off.
    -- Billing-issue rows never get founding access, matching the TS gates.
    IF NOT has_unlimited_favorites
      AND favorite_count >= 3
      AND (has_billing_issue OR NOT public.founding_access_enabled()) THEN
      RAISE EXCEPTION 'favorite_quota_exceeded'
        USING DETAIL = 'free_favorites_limit';
    END IF;
  END IF;

  SELECT COALESCE(max(fb.rank), 0) + 1 INTO next_rank
  FROM public.favorite_beaches fb
  WHERE fb.user_id = current_user_id;

  INSERT INTO public.favorite_beaches (
    user_id,
    beach_id,
    custom_spot_id,
    rank,
    alerts_enabled
  )
  VALUES (
    current_user_id,
    p_beach_id,
    p_custom_spot_id,
    next_rank,
    false
  );

  RETURN 'added';
END;
$$;

-- Personal match: not locked for reason 'free' while founding access is on.
CREATE OR REPLACE FUNCTION public.user_match_access_result(p_user_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $access$
DECLARE
  v_role text := COALESCE(auth.role(), 'anon');
  v_caller uuid := auth.uid();
  v_is_paid boolean := false;
  v_billing_issue boolean := false;
  v_expires_at timestamptz;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_caller IS NULL OR p_user_id <> v_caller THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Personal match unlocks with your account',
        'reason_bullets', jsonb_build_array('Sign in with the matching account to use personal match.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'forbidden'
      );
    END IF;

    SELECT
      COALESCE(ue.is_pro, false) OR COALESCE(ue.is_trialing, false),
      COALESCE(ue.billing_issue, false),
      ue.expires_at
    INTO v_is_paid, v_billing_issue, v_expires_at
    FROM public.user_entitlements ue
    WHERE ue.user_id = p_user_id
    LIMIT 1;

    IF v_billing_issue THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Update payment to use personal match',
        'reason_bullets', jsonb_build_array('Your forecast is still here. Update your payment method to turn personal match back on.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'billing_issue'
      );
    END IF;

    IF (NOT COALESCE(v_is_paid, false) OR (v_expires_at IS NOT NULL AND v_expires_at < now()))
      AND NOT public.founding_access_enabled() THEN
      RETURN jsonb_build_object(
        'state', 'locked',
        'score', NULL,
        'fit_label', 'Personal match unlocks with Pro',
        'reason_bullets', jsonb_build_array('Forecasts stay free. Pro adds your fit, reasons, ranked windows, and personal alerts.'),
        'session_count', 0,
        'sessions_needed', 5,
        'quality_band', 'locked',
        'lock_reason', 'free'
      );
    END IF;
  END IF;

  RETURN NULL;
END;
$access$;

-- Personal match candidates: same rule; billing issues still return nothing.
CREATE OR REPLACE FUNCTION public.get_user_match_candidates(
  p_user_id uuid,
  p_exclude_beach_id uuid DEFAULT NULL::uuid,
  p_device_lat double precision DEFAULT NULL::double precision,
  p_device_lon double precision DEFAULT NULL::double precision,
  p_radius_km double precision DEFAULT 50,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(beach jsonb, score numeric, label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_have_device boolean :=
    p_device_lat IS NOT NULL
    AND p_device_lon IS NOT NULL
    AND p_device_lat BETWEEN -90 AND 90
    AND p_device_lon BETWEEN -180 AND 180;
  v_role text := COALESCE(auth.role(), 'anon');
  v_caller uuid := auth.uid();
  v_is_paid boolean := false;
  v_billing_issue boolean := false;
  v_expires_at timestamptz;
  v_max_drive_minutes integer;
  v_profile_radius_km double precision;
  v_effective_radius_km double precision;
BEGIN
  IF v_role <> 'service_role' THEN
    IF v_caller IS NULL OR p_user_id <> v_caller THEN
      RETURN;
    END IF;

    SELECT
      COALESCE(ue.is_pro, false) OR COALESCE(ue.is_trialing, false),
      COALESCE(ue.billing_issue, false),
      ue.expires_at
    INTO v_is_paid, v_billing_issue, v_expires_at
    FROM public.user_entitlements ue
    WHERE ue.user_id = p_user_id
    LIMIT 1;

    IF v_billing_issue THEN
      RETURN;
    END IF;

    IF (NOT COALESCE(v_is_paid, false)
      OR (v_expires_at IS NOT NULL AND v_expires_at < now()))
      AND NOT public.founding_access_enabled() THEN
      RETURN;
    END IF;
  END IF;

  SELECT p.max_drive_minutes
  INTO v_max_drive_minutes
  FROM public.profiles p
  WHERE p.id = p_user_id
  LIMIT 1;

  v_profile_radius_km := CASE
    WHEN v_max_drive_minutes IS NULL THEN 100.0
    ELSE LEAST(GREATEST(v_max_drive_minutes, 15), 90) * 0.5 * 1.609344
  END;
  v_effective_radius_km := LEAST(
    v_profile_radius_km,
    GREATEST(COALESCE(p_radius_km, v_profile_radius_km), 0)
  );

  RETURN QUERY
  WITH device_location AS (
    SELECT ST_SetSRID(ST_MakePoint(p_device_lon, p_device_lat), 4326)::geography AS geog
    WHERE v_have_device
  ),
  local_candidate_beaches AS (
    SELECT
      b.id,
      b.name,
      b.lat,
      b.lon,
      ST_Distance(b.geog, device_location.geog) / 1000.0 AS distance_km,
      'device_radius'::text AS candidate_source
    FROM public.beaches b
    CROSS JOIN device_location
    WHERE v_have_device
      AND b.deleted_at IS NULL
      AND b.recommendation_eligible
      AND b.geog IS NOT NULL
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND ST_DWithin(
        b.geog,
        device_location.geog,
        v_effective_radius_km * 1000
      )
  ),
  favorite_candidate_beaches AS (
    SELECT
      b.id,
      b.name,
      b.lat,
      b.lon,
      NULL::double precision AS distance_km,
      'favorite'::text AS candidate_source
    FROM public.beaches b
    WHERE NOT v_have_device
      AND b.deleted_at IS NULL
      AND b.recommendation_eligible
      AND (p_exclude_beach_id IS NULL OR b.id <> p_exclude_beach_id)
      AND EXISTS (
        SELECT 1
        FROM public.favorite_beaches fb
        WHERE fb.user_id = p_user_id
          AND fb.beach_id = b.id
      )
  ),
  combined_candidate_beaches AS (
    SELECT * FROM local_candidate_beaches
    UNION ALL
    SELECT * FROM favorite_candidate_beaches
  ),
  actionable_forecast AS (
    SELECT DISTINCT ON (ef.beach_id)
      ef.beach_id,
      ef.wave_height,
      ef.wave_period,
      ef.wind_speed,
      (ef.wind_direction_deg)::text AS wind_direction,
      ef.tide_height
    FROM public.enhanced_forecasts ef
    WHERE ef.beach_id IN (SELECT id FROM combined_candidate_beaches)
      AND ef.forecast_at IS NOT NULL
      AND ef.forecast_at >= now() - interval '45 minutes'
      AND ef.forecast_at <= now() + interval '72 hours'
    ORDER BY
      ef.beach_id,
      CASE WHEN ef.forecast_at::date = now()::date THEN 0 ELSE 1 END,
      ABS(EXTRACT(EPOCH FROM (ef.forecast_at - now()))),
      ef.forecast_at ASC
  ),
  scored AS (
    SELECT
      cb.id,
      cb.name,
      cb.lat,
      cb.lon,
      cb.distance_km,
      cb.candidate_source,
      public.compute_user_match_score(
        p_user_id,
        cb.id,
        af.wave_height,
        af.wave_period,
        af.wind_speed,
        af.wind_direction,
        af.tide_height
      ) AS result
    FROM combined_candidate_beaches cb
    JOIN actionable_forecast af ON af.beach_id = cb.id
  )
  SELECT
    jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'lat', s.lat,
      'lon', s.lon,
      'distance_km', s.distance_km,
      'candidate_source', s.candidate_source
    ) AS beach,
    (s.result->>'score')::numeric AS score,
    COALESCE(s.result->>'label', s.result->>'fit_label') AS label
  FROM scored s
  WHERE s.result->>'state' IN ('ready', 'learned')
    AND jsonb_typeof(s.result->'score') = 'number'
  ORDER BY (s.result->>'score')::numeric DESC NULLS LAST
  LIMIT p_limit;
END;
$function$;

-- Week Scout, discovery similarity and bulk decision context match evidence.
CREATE OR REPLACE FUNCTION public.get_week_scout_personalization(
  p_user_id uuid,
  p_beach_ids uuid[],
  p_slots jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_entitlement jsonb;
  v_matches jsonb := '[]'::jsonb;
BEGIN
  IF p_user_id IS NULL OR p_beach_ids IS NULL
    OR jsonb_typeof(p_slots) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid Week Scout personalization input';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_slots) slot
    WHERE (slot->>'beach_id') IS NULL
      OR NOT ((slot->>'beach_id')::uuid = ANY(p_beach_ids))
      OR NULLIF(slot->>'forecast_at', '') IS NULL
  ) THEN
    RAISE EXCEPTION 'Match slots must belong to the requested beaches';
  END IF;

  SELECT jsonb_build_object(
    'is_pro', ue.is_pro, 'is_trialing', ue.is_trialing,
    'billing_issue', ue.billing_issue, 'expires_at', ue.expires_at
  ) INTO v_entitlement
  FROM public.user_entitlements ue WHERE ue.user_id = p_user_id;

  -- Mirror entitlementFromRow: paid/trial flags, expiry, and billing grace.
  -- Founding access scores matches too, except on billing-issue rows (which
  -- never get founding access); callers still decide what to show.
  IF jsonb_array_length(p_slots) > 0
    AND ((
      (COALESCE((v_entitlement->>'is_pro')::boolean, false)
        OR COALESCE((v_entitlement->>'is_trialing')::boolean, false))
      AND (COALESCE((v_entitlement->>'billing_issue')::boolean, false)
        OR v_entitlement->>'expires_at' IS NULL
        OR (v_entitlement->>'expires_at')::timestamptz >= clock_timestamp())
    ) OR (public.founding_access_enabled()
      AND NOT COALESCE((v_entitlement->>'billing_issue')::boolean, false))) THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'beach_id', m.beach_id, 'forecast_at', m.forecast_at, 'result', m.result
    ) ORDER BY m.slot_idx), '[]'::jsonb) INTO v_matches
    FROM public.compute_user_match_scores(p_user_id, p_beach_ids,
      (SELECT COALESCE(jsonb_agg(slot), '[]'::jsonb)
        FROM (SELECT DISTINCT value AS slot FROM jsonb_array_elements(p_slots)) slots)) m;
  END IF;

  RETURN jsonb_build_object(
    'entitlement', v_entitlement, 'matches', v_matches
  );
END;
$function$;

NOTIFY pgrst, 'reload schema';

COMMIT;
