-- Coast-domain shadow demand dedupe against the real record RPC. Events are synthetic copies of a real
-- ingested impact (FKs and append-only triggers bypassed in replica mode) so each links to a real batch.
INSERT INTO auth.users(id) VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),('cccccccc-cccc-4ccc-8ccc-cccccccccccc');
CREATE TABLE public.dedup_events(label text PRIMARY KEY,id uuid,batch uuid);
CREATE FUNCTION public.dedup_event(p_label text,p_region text,p_arrival timestamptz,p_batch uuid) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE template record; v_id uuid:=gen_random_uuid();
BEGIN
  SELECT impact_link.* INTO template FROM public.swell_watch_event_impacts impact_link
    JOIN public.swell_watch_beach_impacts impact ON impact.id=impact_link.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    WHERE observation.provider_batch_id=p_batch AND impact.policy_hash=repeat('a',64) LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'no template impact for batch %',p_batch; END IF;
  SET LOCAL session_replication_role=replica;
  INSERT INTO public.swell_watch_regional_events(id,region_key,physical_key) VALUES(v_id,p_region,'dedup-'||p_label);
  INSERT INTO public.swell_watch_event_impacts(id,regional_event_id,evaluation_id,beach_id,beach_impact_id,arrival_at,peak_at,evaluated_at)
    VALUES(gen_random_uuid(),v_id,template.evaluation_id,template.beach_id,template.beach_impact_id,p_arrival,p_arrival+interval '2 hours',clock_timestamp());
  SET LOCAL session_replication_role=origin;
  INSERT INTO public.dedup_events VALUES(p_label,v_id,p_batch);
  RETURN v_id;
END; $$;
CREATE FUNCTION public.dedup_pairs(VARIADIC specs text[]) RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object('regional_event_id',e.id,'recipient_id',
    CASE split_part(s,':',2) WHEN 'u1' THEN 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' WHEN 'u2' THEN 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' ELSE 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' END))
  FROM unnest(specs) s JOIN public.dedup_events e ON e.label=split_part(s,':',1);
$$;
CREATE FUNCTION public.dedup_pair_count(p_label text,p_user text) RETURNS bigint LANGUAGE sql AS $$
  SELECT count(*) FROM public.swell_watch_shadow_demand_pairs pair JOIN public.dedup_events e ON e.id=pair.regional_event_id
  WHERE e.label=p_label AND pair.recipient_id=CASE p_user WHEN 'u1' THEN 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid WHEN 'u2' THEN 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid ELSE 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid END;
$$;

DO $$
DECLARE
  b1 uuid; b2 uuid; t timestamptz:=date_trunc('hour',now())+interval '10 days'; first_run record; retry_run record; second_run record;
  pairs_before bigint; obs_before bigint; duplicate_of text;
BEGIN
  PERFORM public.study_assert(public.swell_watch_coast_domain('san-diego')='socal' AND public.swell_watch_coast_domain('orange-county')='socal'
    AND public.swell_watch_coast_domain('outer-banks')='outer-banks' AND public.swell_watch_coast_domain('santa-cruz')='santa-cruz','coast domain mapping');
  SELECT b.id INTO STRICT b1 FROM public.swell_watch_provider_run_completed_batches b JOIN public.study_pending p ON p.revision_set_id=b.revision_set_id;
  SELECT provider_batch_id INTO STRICT b2 FROM public.study_manual_batch;
  -- A: san-diego T. B: orange-county T+20h (<=24h from A, same swell). D: other domain at T+10h.
  PERFORM public.dedup_event('A','san-diego',t,b1);
  PERFORM public.dedup_event('B','orange-county',t+interval '20 hours',b1);
  PERFORM public.dedup_event('D','outer-banks',t+interval '10 hours',b1);
  SELECT * INTO first_run FROM public.record_swell_watch_shadow_demand(b1,repeat('a',64),public.dedup_pairs('A:u1','B:u1','D:u1','A:u2'));
  PERFORM public.study_assert(first_run.recorded_pairs_24h=3,'same-batch duplicate excluded from count');
  PERFORM public.study_assert(public.dedup_pair_count('A','u1')=1 AND public.dedup_pair_count('B','u1')=0
    AND public.dedup_pair_count('D','u1')=1 AND public.dedup_pair_count('A','u2')=1,'same-batch pairs');
  SELECT o.duplicate_of_regional_event_id::text INTO duplicate_of FROM public.swell_watch_shadow_demand_observations o
    JOIN public.dedup_events e ON e.id=o.regional_event_id WHERE o.provider_batch_id=b1 AND e.label='B';
  PERFORM public.study_assert(duplicate_of=(SELECT id::text FROM public.dedup_events WHERE label='A'),'skipped pair keeps duplicate_of on observation ledger');
  PERFORM public.study_assert((SELECT count(*) FROM public.swell_watch_shadow_demand_observations WHERE provider_batch_id=b1)=4,'all four requested pairs observed');
  -- Retry of the same evaluation is idempotent and does not raise "shadow evaluation demand changed".
  pairs_before:=(SELECT count(*) FROM public.swell_watch_shadow_demand_pairs);
  obs_before:=(SELECT count(*) FROM public.swell_watch_shadow_demand_observations);
  SELECT * INTO retry_run FROM public.record_swell_watch_shadow_demand(b1,repeat('a',64),public.dedup_pairs('A:u1','B:u1','D:u1','A:u2'));
  PERFORM public.study_assert(retry_run.observed_at=first_run.observed_at AND retry_run.recorded_pairs_24h=first_run.recorded_pairs_24h,'retry returns the first result');
  PERFORM public.study_assert((SELECT count(*) FROM public.swell_watch_shadow_demand_pairs)=pairs_before
    AND (SELECT count(*) FROM public.swell_watch_shadow_demand_observations)=obs_before,'retry writes nothing');
  PERFORM public.study_error(format('SELECT public.record_swell_watch_shadow_demand(%L,%L,%L)',b1,repeat('a',64),public.dedup_pairs('A:u1')),'shadow evaluation demand changed');
  -- Later issuance: E at T+40h is 20h from B, 40h from A. B never got a pair; the chain A-B-E is still one swell.
  PERFORM public.dedup_event('E','orange-county',t+interval '40 hours',b2);
  PERFORM public.dedup_event('F','orange-county',t+interval '120 hours',b2);
  SELECT * INTO second_run FROM public.record_swell_watch_shadow_demand(b2,repeat('a',64),public.dedup_pairs('E:u1','E:u3','F:u1'));
  PERFORM public.study_assert(public.dedup_pair_count('E','u1')=0,'chained later event is the same swell for a paired recipient');
  PERFORM public.study_assert(public.dedup_pair_count('E','u3')=1,'new recipient still gets the swell');
  PERFORM public.study_assert(public.dedup_pair_count('F','u1')=1,'event past the 24h chain gap is a new swell');
  PERFORM public.study_assert(second_run.recorded_pairs_24h=5,'24h demand counts only kept pairs');
  SELECT o.duplicate_of_regional_event_id::text INTO duplicate_of FROM public.swell_watch_shadow_demand_observations o
    JOIN public.dedup_events e ON e.id=o.regional_event_id WHERE o.provider_batch_id=b2 AND e.label='E' AND o.recipient_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  PERFORM public.study_assert(duplicate_of=(SELECT id::text FROM public.dedup_events WHERE label='A'),'duplicate points at the event holding the pair');
  PERFORM public.study_assert((SELECT count(*) FROM public.swell_watch_shadow_demand_pairs)=pairs_before+2,'only kept pairs persisted');
END; $$;

-- 72 h cap, ordered pass, and bounded lookback, exercised on the grouping helper directly.
CREATE FUNCTION public.dedup_dupes(p_pairs jsonb) RETURNS text LANGUAGE sql AS $$
  SELECT coalesce(string_agg(e.label,',' ORDER BY e.label),'') FROM public.swell_watch_shadow_demand_duplicates(p_pairs) d
  JOIN public.dedup_events e ON e.id=d.regional_event_id;
$$;
DO $$
DECLARE b2 uuid; t timestamptz:=date_trunc('hour',now())+interval '30 days'; held_before bigint; k int;
BEGIN
  SELECT provider_batch_id INTO STRICT b2 FROM public.study_manual_batch;
  -- (a) Events 20 h apart for 6 days: every link is within 24 h, but the 72 h cap splits the chain at S4.
  FOR k IN 0..6 LOOP PERFORM public.dedup_event('S'||k,'santa-cruz',t+k*interval '20 hours',b2); END LOOP;
  PERFORM public.study_assert(public.dedup_dupes(public.dedup_pairs('S0:u1','S1:u1','S2:u1','S3:u1','S4:u1','S5:u1','S6:u1'))='S1,S2,S3,S5,S6',
    'chain past 72 h keeps a second pair for the same recipient');
  -- Cross-run: S0 already held; S4 starts a new swell and is kept, S5 repeats it.
  SET LOCAL session_replication_role=replica;
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT id,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now()-interval '1 day' FROM public.dedup_events WHERE label='S0';
  SET LOCAL session_replication_role=origin;
  PERFORM public.study_assert(public.dedup_dupes(public.dedup_pairs('S3:u1','S4:u1','S5:u1'))='S3,S5','held pair covers its own swell only');
  -- Input order does not matter.
  PERFORM public.study_assert(public.dedup_dupes(public.dedup_pairs('S6:u1','S5:u1','S4:u1','S3:u1'))='S3,S5,S6','deterministic regardless of request order');
  -- (c) An old held event far outside the 5 day lookback never groups with a current event.
  PERFORM public.dedup_event('OLD','santa-cruz',t-interval '40 days',b2);
  PERFORM public.dedup_event('NEW','santa-cruz',t+interval '9 days',b2);
  SET LOCAL session_replication_role=replica;
  INSERT INTO public.swell_watch_shadow_demand_pairs(regional_event_id,recipient_id,first_observed_at)
    SELECT id,'cccccccc-cccc-4ccc-8ccc-cccccccccccc',now()-interval '2 days' FROM public.dedup_events WHERE label='OLD';
  SET LOCAL session_replication_role=origin;
  PERFORM public.study_assert(public.dedup_dupes(public.dedup_pairs('NEW:u3'))='','old event outside lookback does not suppress');
END; $$;
