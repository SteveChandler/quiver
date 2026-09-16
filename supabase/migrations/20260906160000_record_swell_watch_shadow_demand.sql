-- Shadow demand only: never read by release/queue authority or actual-send budget.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE public.swell_watch_shadow_demand_runs (
  provider_batch_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_completed_batches(id),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  recipient_events jsonb NOT NULL CHECK (jsonb_typeof(recipient_events)='array'),
  recorded_pairs_24h bigint NOT NULL CHECK (recorded_pairs_24h>=0),
  PRIMARY KEY(provider_batch_id,policy_hash)
);
CREATE TABLE public.swell_watch_shadow_demand_pairs (
  regional_event_id uuid NOT NULL REFERENCES public.swell_watch_regional_events(id),
  recipient_id uuid NOT NULL REFERENCES auth.users(id),
  first_observed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(regional_event_id,recipient_id)
);
CREATE INDEX swell_watch_shadow_demand_pairs_time ON public.swell_watch_shadow_demand_pairs(first_observed_at);
ALTER TABLE public.swell_watch_shadow_demand_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_shadow_demand_pairs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_shadow_demand_runs,public.swell_watch_shadow_demand_pairs FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER swell_watch_shadow_demand_runs_append_only BEFORE INSERT OR UPDATE OR DELETE
  ON public.swell_watch_shadow_demand_runs FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();
CREATE TRIGGER swell_watch_shadow_demand_pairs_append_only BEFORE INSERT OR UPDATE OR DELETE
  ON public.swell_watch_shadow_demand_pairs FOR EACH ROW EXECUTE FUNCTION public.swell_watch_append_only_trigger();

CREATE FUNCTION public.record_swell_watch_shadow_demand(p_provider_batch_id uuid,p_policy_hash text,p_pairs jsonb)
RETURNS TABLE(observed_at timestamptz,recorded_pairs_24h bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE canonical jsonb; previous public.swell_watch_shadow_demand_runs; measured_at timestamptz; total bigint; run_at timestamptz;
BEGIN
  IF jsonb_typeof(p_pairs) IS DISTINCT FROM 'array' OR jsonb_array_length(p_pairs)>10000 THEN
    RAISE EXCEPTION 'invalid shadow demand';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_pairs) pair
    WHERE jsonb_typeof(pair) IS DISTINCT FROM 'object'
      OR pair - 'regional_event_id' - 'recipient_id' <> '{}'::jsonb
      OR coalesce(pair->>'regional_event_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
      OR coalesce(pair->>'recipient_id','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$') THEN
    RAISE EXCEPTION 'invalid shadow recipient/event pair';
  END IF;
  SELECT coalesce(jsonb_agg(pair ORDER BY pair->>'regional_event_id',pair->>'recipient_id'),'[]'::jsonb)
    INTO canonical FROM (SELECT DISTINCT pair FROM jsonb_array_elements(p_pairs) pair) pairs;
  IF jsonb_array_length(canonical) <> jsonb_array_length(p_pairs) THEN RAISE EXCEPTION 'duplicate shadow pair'; END IF;
  SELECT issuance.run_utc INTO run_at FROM public.swell_watch_provider_run_completed_batches completed
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE completed.id=p_provider_batch_id;
  IF run_at IS NULL THEN RAISE EXCEPTION 'completed shadow provider run required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' ||
    to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  -- ponytail: global serialization; partition only if measured collector throughput requires it.
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NOT EXISTS(SELECT 1 FROM public.swell_watch_get_matching_policy() p WHERE p.policy_hash=p_policy_hash
      AND p.revoked_at IS NULL AND p.superseded_at IS NULL
      AND isfinite(p.not_before) AND isfinite(p.expires_at)
      AND clock_timestamp()>=p.not_before AND clock_timestamp()<p.expires_at)
    OR public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'current shadow policy and provider evidence required';
  END IF;
  SELECT * INTO previous FROM public.swell_watch_shadow_demand_runs r
    WHERE r.provider_batch_id=p_provider_batch_id AND r.policy_hash=p_policy_hash;
  IF FOUND THEN
    IF previous.recipient_events IS DISTINCT FROM canonical THEN RAISE EXCEPTION 'shadow evaluation demand changed'; END IF;
    RETURN QUERY SELECT previous.observed_at,previous.recorded_pairs_24h;
    RETURN;
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(canonical) pair WHERE NOT EXISTS(
    SELECT 1 FROM public.swell_watch_event_impacts link
    JOIN public.swell_watch_beach_impacts impact ON impact.id=link.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    WHERE link.regional_event_id=(pair->>'regional_event_id')::uuid
      AND observation.provider_batch_id=p_provider_batch_id AND impact.policy_hash=p_policy_hash)) THEN
    RAISE EXCEPTION 'shadow event differs from evaluation';
  END IF;
  measured_at := clock_timestamp();
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT (pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at
    FROM jsonb_array_elements(canonical) pair
    ON CONFLICT(regional_event_id,recipient_id) DO NOTHING;
  SELECT count(*) INTO total FROM public.swell_watch_shadow_demand_pairs pair
    WHERE pair.first_observed_at>measured_at-interval '24 hours' AND pair.first_observed_at<=measured_at;
  INSERT INTO public.swell_watch_shadow_demand_runs(provider_batch_id,policy_hash,observed_at,recipient_events,recorded_pairs_24h)
    VALUES(p_provider_batch_id,p_policy_hash,measured_at,canonical,total);
  RETURN QUERY SELECT measured_at,total;
END;
$$;
REVOKE ALL ON FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) TO service_role;
COMMIT;
