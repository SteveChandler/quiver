-- Rollback for 20261004120000_dedupe_swell_watch_shadow_demand_by_coast.sql.
-- Restores record_swell_watch_shadow_demand to its 20260918180000 definition (hash 343ffc92...) and drops the
-- dedupe helpers. The duplicate_of_regional_event_id column and existing observation/pair rows are kept (ledger
-- is append-only); after rollback the old function counts flagged duplicates again in recorded_pairs_24h.
BEGIN;
DO $rollback$
BEGIN
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex')
    NOT IN ('62cef61fbd2e6d8cacb5bbdfcbf909cbb7fc90d75766e4818fd85a2faeaa4c6e','343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a') THEN
    RAISE EXCEPTION 'shadow demand definition differs from reviewed baseline';
  END IF;
END;
$rollback$;
CREATE OR REPLACE FUNCTION public.record_swell_watch_shadow_demand(p_provider_batch_id uuid,p_policy_hash text,p_pairs jsonb)
RETURNS TABLE(observed_at timestamptz,recorded_pairs_24h bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE canonical jsonb; previous public.swell_watch_shadow_demand_runs; measured_at timestamptz; total bigint; run_at timestamptz;
BEGIN
  IF jsonb_typeof(p_pairs) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pairs)>10000 THEN RAISE EXCEPTION 'invalid shadow demand'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_pairs) pair WHERE jsonb_typeof(pair) IS DISTINCT FROM 'object' OR pair-'regional_event_id'-'recipient_id'<>'{}'::jsonb
    OR coalesce(pair->>'regional_event_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR coalesce(pair->>'recipient_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') THEN RAISE EXCEPTION 'invalid shadow recipient/event pair'; END IF;
  SELECT coalesce(jsonb_agg(pair ORDER BY pair->>'regional_event_id',pair->>'recipient_id'),'[]'::jsonb) INTO canonical FROM (SELECT DISTINCT pair FROM jsonb_array_elements(p_pairs) pair) pairs;
  IF jsonb_array_length(canonical)<>jsonb_array_length(p_pairs) THEN RAISE EXCEPTION 'duplicate shadow pair'; END IF;
  SELECT issuance.run_utc INTO run_at FROM public.swell_watch_provider_run_completed_batches completed JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id WHERE completed.id=p_provider_batch_id;
  IF run_at IS NULL THEN RAISE EXCEPTION 'completed shadow provider run required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NOT EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy() p WHERE p.policy_hash=p_policy_hash AND p.revoked_at IS NULL AND p.superseded_at IS NULL
    AND isfinite(p.not_before) AND isfinite(p.expires_at) AND clock_timestamp()>=p.not_before AND clock_timestamp()<p.expires_at)
    OR public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'current shadow policy and provider evidence required'; END IF;
  SELECT * INTO previous FROM public.swell_watch_shadow_demand_runs r WHERE r.provider_batch_id=p_provider_batch_id AND r.policy_hash=p_policy_hash;
  IF FOUND THEN
    IF previous.recipient_events IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'shadow evaluation demand changed'; END IF;
    RETURN QUERY SELECT previous.observed_at,previous.recorded_pairs_24h; RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(canonical) pair WHERE NOT EXISTS(SELECT 1 FROM public.swell_watch_event_impacts link JOIN public.swell_watch_beach_impacts impact ON impact.id=link.beach_impact_id JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id WHERE link.regional_event_id=(pair->>'regional_event_id')::uuid AND observation.provider_batch_id=p_provider_batch_id AND impact.policy_hash=p_policy_hash)) THEN RAISE EXCEPTION 'shadow event differs from evaluation'; END IF;
  measured_at:=clock_timestamp();
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT (pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at FROM jsonb_array_elements(canonical) pair ON CONFLICT(regional_event_id,recipient_id) DO NOTHING;
  INSERT INTO public.swell_watch_shadow_demand_observations(provider_batch_id,policy_hash,regional_event_id,recipient_id,observed_at)
    SELECT p_provider_batch_id,p_policy_hash,(pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at FROM jsonb_array_elements(canonical) pair;
  SELECT count(DISTINCT (observation.regional_event_id,observation.recipient_id)) INTO total FROM public.swell_watch_shadow_demand_observations observation WHERE observation.observed_at>measured_at-interval '24 hours' AND observation.observed_at<=measured_at;
  INSERT INTO public.swell_watch_shadow_demand_runs(provider_batch_id,policy_hash,observed_at,recipient_events,recorded_pairs_24h) VALUES(p_provider_batch_id,p_policy_hash,measured_at,canonical,total);
  RETURN QUERY SELECT measured_at,total;
END;
$$;
ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) SET lock_timeout='10s';
ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) SET statement_timeout='60s';
REVOKE ALL ON FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) TO service_role;
DROP FUNCTION IF EXISTS public.swell_watch_shadow_demand_duplicates(jsonb);
DROP FUNCTION IF EXISTS public.swell_watch_coast_domain(text);
DO $rollback$
BEGIN
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex')<>'343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a' THEN
    RAISE EXCEPTION 'shadow demand rollback hash mismatch';
  END IF;
END;
$rollback$;
COMMIT;
