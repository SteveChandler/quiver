-- Service-only producer metrics from existing ledgers; no new collection or authority.
-- Rollback: revoke/drop this reader and keep the runtime producer disabled.
BEGIN;
CREATE FUNCTION public.read_swell_watch_delivery_health(p_policy_hash text)
RETURNS TABLE(policy_hash text,samples bigint,failures bigint,projected_sends bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE authority record; window_minutes integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO authority FROM public.swell_watch_get_production_authority();
  IF NOT FOUND OR authority.policy_hash IS DISTINCT FROM p_policy_hash
    OR authority.production_scope IS DISTINCT FROM 'swell_watch_push'
    OR authority.policy_provenance IS DISTINCT FROM 'production_approved'
    OR authority.policy_values #> '{volume_caps,projected_send_window_hours}' IS DISTINCT FROM '24'::jsonb
    OR authority.revoked_at IS NOT NULL OR authority.superseded_at IS NOT NULL
    OR isfinite(authority.not_before) IS DISTINCT FROM true OR isfinite(authority.expires_at) IS DISTINCT FROM true
    OR clock_timestamp() < authority.not_before OR clock_timestamp() >= authority.expires_at
    OR public.swell_watch_production_policy_values_valid(authority.policy_values) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current delivery policy authority is required';
  END IF;
  window_minutes := (authority.policy_values #>> '{provider_failure_hold,window_minutes}')::integer;
  RETURN QUERY SELECT authority.policy_hash::text,
    coalesce(sum(outcome.sample_count),0)::bigint,coalesce(sum(outcome.failure_count),0)::bigint,
    public.swell_watch_projected_send_count()
  FROM public.swell_watch_provider_delivery_outcomes outcome
  WHERE outcome.created_at >= transaction_timestamp() - make_interval(mins => window_minutes)
    AND outcome.created_at <= transaction_timestamp();
END;
$$;
REVOKE ALL ON FUNCTION public.read_swell_watch_delivery_health(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.read_swell_watch_delivery_health(text) TO service_role;
COMMIT;
