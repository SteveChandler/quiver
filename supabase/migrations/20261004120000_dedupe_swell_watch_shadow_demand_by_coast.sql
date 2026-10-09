-- One would-be notification per recipient per physical swell. Rolling forecasts re-mint regional_event_id
-- whenever arrival/peak drifts past the pinned 6 h matching delta, so one swell fanned out into several
-- (event, recipient) pairs. Identity, thresholds, and the study/policy hashes are left untouched: demand is
-- deduped at record time. Events in one coast domain whose arrival windows are <= 24 h apart (transitively,
-- capped at 72 h from the swell's first window start) are one swell; the first pair for a recipient in that swell wins. Skipped duplicates stay on the append-only
-- observation ledger (duplicate_of_regional_event_id) and are excluded from recorded_pairs_24h.
-- Coast domains live in swell_watch_coast_domain() below, NOT in the study cohort or policy values, so the
-- authority config_hash and policy_hash are unchanged. A new region_key needs only a redefinition here.
-- Rollback: docs/operations/swell-watch-shadow-demand-coast-dedup-rollback.sql
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.swell_watch_shadow_demand_observations
  ADD COLUMN IF NOT EXISTS duplicate_of_regional_event_id uuid REFERENCES public.swell_watch_regional_events(id);

CREATE OR REPLACE FUNCTION public.swell_watch_coast_domain(p_region_key text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public,pg_temp AS $$
  SELECT CASE WHEN p_region_key IN ('san-diego','orange-county') THEN 'socal' ELSE p_region_key END;
$$;
REVOKE ALL ON FUNCTION public.swell_watch_coast_domain(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.swell_watch_coast_domain(text) TO service_role;

-- Pairs from p_pairs that repeat a swell the recipient already holds (or holds earlier in the same input).
-- Swells are built per domain by one ordered pass over event windows (start_at, id): an event joins the open swell
-- when it starts <= 24 h after the latest arrival so far (chain) AND <= 72 h after the swell's first start (cap);
-- otherwise it opens a new swell. Only events within 5 days of the requested windows are scanned.
CREATE OR REPLACE FUNCTION public.swell_watch_shadow_demand_duplicates(p_pairs jsonb)
RETURNS TABLE(regional_event_id uuid, recipient_id uuid, duplicate_of uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  WITH RECURSIVE input AS (
    SELECT (pair->>'regional_event_id')::uuid AS ev,(pair->>'recipient_id')::uuid AS rec FROM jsonb_array_elements(p_pairs) pair
  ), bounds AS (
    SELECT public.swell_watch_coast_domain(event.region_key) AS domain,
      min(impact.arrival_at) AS start_at,max(impact.arrival_at) AS end_at
    FROM (SELECT DISTINCT ev FROM input) requested
    JOIN public.swell_watch_regional_events event ON event.id=requested.ev
    JOIN public.swell_watch_event_impacts impact ON impact.regional_event_id=event.id
    GROUP BY 1
  ), win AS (
    SELECT event.id,bounds.domain,min(impact.arrival_at) AS start_at,max(impact.arrival_at) AS end_at
    FROM bounds
    JOIN public.swell_watch_regional_events event ON public.swell_watch_coast_domain(event.region_key)=bounds.domain
    JOIN public.swell_watch_event_impacts impact ON impact.regional_event_id=event.id
    GROUP BY event.id,bounds.domain,bounds.start_at,bounds.end_at
    HAVING max(impact.arrival_at)>=bounds.start_at-interval '5 days' AND min(impact.arrival_at)<=bounds.end_at+interval '5 days'
  ), ordered AS (
    SELECT id,domain,start_at,end_at,row_number() OVER (PARTITION BY domain ORDER BY start_at,id::text) AS rn FROM win
  ), walk(id,domain,rn,swell_start,latest_end,root) AS (
    SELECT id,domain,rn,start_at,end_at,id::text FROM ordered WHERE rn=1
    UNION ALL
    SELECT o.id,o.domain,o.rn,
      CASE WHEN s.same THEN walk.swell_start ELSE o.start_at END,
      CASE WHEN s.same THEN greatest(walk.latest_end,o.end_at) ELSE o.end_at END,
      CASE WHEN s.same THEN walk.root ELSE o.id::text END
    FROM walk JOIN ordered o ON o.domain=walk.domain AND o.rn=walk.rn+1
    CROSS JOIN LATERAL (SELECT o.start_at<=walk.latest_end+interval '24 hours'
      AND o.start_at<=walk.swell_start+interval '72 hours' AS same) s
  ), swell AS (
    SELECT id,root FROM walk
  ), requested AS (
    SELECT input.ev,input.rec,swell.root,win.start_at FROM input
    JOIN swell ON swell.id=input.ev JOIN win ON win.id=input.ev
  ), held AS (
    SELECT DISTINCT ON (r.rec,r.root) r.rec,r.root,pair.regional_event_id AS keeper
    FROM (SELECT DISTINCT rec,root FROM requested) r
    JOIN public.swell_watch_shadow_demand_pairs pair ON pair.recipient_id=r.rec
    JOIN swell ON swell.id=pair.regional_event_id AND swell.root=r.root
    ORDER BY r.rec,r.root,pair.first_observed_at,pair.regional_event_id::text
  ), first_requested AS (
    SELECT DISTINCT ON (rec,root) rec,root,ev AS keeper FROM requested ORDER BY rec,root,start_at,ev::text
  )
  SELECT requested.ev,requested.rec,coalesce(held.keeper,first_requested.keeper)
  FROM requested
  JOIN first_requested ON first_requested.rec=requested.rec AND first_requested.root=requested.root
  LEFT JOIN held ON held.rec=requested.rec AND held.root=requested.root
  WHERE requested.ev<>coalesce(held.keeper,first_requested.keeper);
$$;
REVOKE ALL ON FUNCTION public.swell_watch_shadow_demand_duplicates(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- record_swell_watch_shadow_demand(uuid,text,jsonb): pre 343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a; post 62cef61fbd2e6d8cacb5bbdfcbf909cbb7fc90d75766e4818fd85a2faeaa4c6e.
DO $amend$
DECLARE current_hash text;
BEGIN
  SELECT encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex') INTO current_hash;
  IF current_hash NOT IN ('343ffc9289a607a6707bf46f4204025a1cb5fe21c8feb5e02a454b86d022c79a','a0988e626f8813aaed74e932d5850e35dde846153c9b9ee3306c778657482931','62cef61fbd2e6d8cacb5bbdfcbf909cbb7fc90d75766e4818fd85a2faeaa4c6e') THEN
    RAISE EXCEPTION 'shadow demand definition differs from reviewed baseline';
  END IF;
END;
$amend$;

CREATE OR REPLACE FUNCTION public.record_swell_watch_shadow_demand(p_provider_batch_id uuid,p_policy_hash text,p_pairs jsonb)
RETURNS TABLE(observed_at timestamptz,recorded_pairs_24h bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE canonical jsonb; previous public.swell_watch_shadow_demand_runs; measured_at timestamptz; total bigint; run_at timestamptz; duplicates jsonb;
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
  SELECT coalesce(jsonb_agg(jsonb_build_object('regional_event_id',d.regional_event_id,'recipient_id',d.recipient_id,'duplicate_of',d.duplicate_of)),'[]'::jsonb)
    INTO duplicates FROM public.swell_watch_shadow_demand_duplicates(canonical) d;
  measured_at:=clock_timestamp();
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT (pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at FROM jsonb_array_elements(canonical) pair
    WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(duplicates) d WHERE d->>'regional_event_id'=pair->>'regional_event_id' AND d->>'recipient_id'=pair->>'recipient_id')
    ON CONFLICT(regional_event_id,recipient_id) DO NOTHING;
  INSERT INTO public.swell_watch_shadow_demand_observations(provider_batch_id,policy_hash,regional_event_id,recipient_id,observed_at,duplicate_of_regional_event_id)
    SELECT p_provider_batch_id,p_policy_hash,(pair->>'regional_event_id')::uuid,(pair->>'recipient_id')::uuid,measured_at,
      (SELECT (d->>'duplicate_of')::uuid FROM jsonb_array_elements(duplicates) d WHERE d->>'regional_event_id'=pair->>'regional_event_id' AND d->>'recipient_id'=pair->>'recipient_id')
    FROM jsonb_array_elements(canonical) pair;
  SELECT count(DISTINCT (observation.regional_event_id,observation.recipient_id)) INTO total FROM public.swell_watch_shadow_demand_observations observation WHERE observation.duplicate_of_regional_event_id IS NULL AND observation.observed_at>measured_at-interval '24 hours' AND observation.observed_at<=measured_at;
  INSERT INTO public.swell_watch_shadow_demand_runs(provider_batch_id,policy_hash,observed_at,recipient_events,recorded_pairs_24h) VALUES(p_provider_batch_id,p_policy_hash,measured_at,canonical,total);
  RETURN QUERY SELECT measured_at,total;
END;
$$;
ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) SET lock_timeout='10s';
ALTER FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) SET statement_timeout='60s';
REVOKE ALL ON FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_swell_watch_shadow_demand(uuid,text,jsonb) TO service_role;

DO $amend$
BEGIN
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_shadow_demand(uuid,text,jsonb)'::regprocedure),'sha256'),'hex')<>'62cef61fbd2e6d8cacb5bbdfcbf909cbb7fc90d75766e4818fd85a2faeaa4c6e' THEN
    RAISE EXCEPTION 'shadow demand definition hash mismatch';
  END IF;
END;
$amend$;
COMMIT;
