-- Apply before deploying the caller; validation uses disposable PostgreSQL only.
-- Replaces four preference/context reads with one view read and one match RPC.
-- Match evidence calls the same scorer as surf/call inside PostgreSQL; no second
-- implementation of its session-history, board, skill or label rules is added.
-- Rollback after reverting the caller: drop this RPC and week_scout_ranking_context.
-- Restore the prior single/batch wrappers before dropping the shared scorer.
BEGIN;

-- One existing preference read now supplies the ranking context before scoring.
-- Service-only view: predicates on user_id push into each user's indexed reads.
CREATE OR REPLACE VIEW public.week_scout_ranking_context
WITH (security_invoker = true) AS
SELECT p.id AS user_id, to_jsonb(prefs) AS learned_prefs,
  to_jsonb(implicit) AS implicit_prefs,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'beach_id', a.beach_id, 'affinity_score', a.affinity_score
  )) FROM public.user_beach_affinity a WHERE a.user_id = p.id), '[]'::jsonb) AS affinity_rows
FROM public.profiles p
LEFT JOIN public.user_surf_preferences prefs ON prefs.user_id = p.id
LEFT JOIN public.user_implicit_preferences implicit ON implicit.user_id = p.id;
REVOKE ALL ON public.week_scout_ranking_context FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.week_scout_ranking_context TO service_role;

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
  IF jsonb_array_length(p_slots) > 0
    AND (COALESCE((v_entitlement->>'is_pro')::boolean, false)
      OR COALESCE((v_entitlement->>'is_trialing')::boolean, false))
    AND (COALESCE((v_entitlement->>'billing_issue')::boolean, false)
      OR v_entitlement->>'expires_at' IS NULL
      OR (v_entitlement->>'expires_at')::timestamptz >= clock_timestamp()) THEN
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

-- Only trusted server requests may select another user's private context.
REVOKE ALL ON FUNCTION public.get_week_scout_personalization(uuid, uuid[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_week_scout_personalization(uuid, uuid[], jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
