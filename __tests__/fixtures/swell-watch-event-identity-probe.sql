-- Real receipt/completion/resolver RPCs. Spans mirror the retained production fragments of
-- 2026-09-20 (San Diego 24-25 September): a moved peak, a second span in one issuance, a later coalesced span.
CREATE FUNCTION public.identity_assert(ok boolean,label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'assertion failed: %',label; END IF; END; $$;
INSERT INTO public.beaches(id) SELECT ('00000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid FROM generate_series(1,10) n;
CREATE FUNCTION public.identity_cohort() RETURNS jsonb LANGUAGE sql AS $$
  SELECT jsonb_agg(jsonb_build_object('sourcePointId','00000000-0000-4000-8000-'||lpad(n::text,12,'0'),'regionKey','study') ORDER BY n)
  FROM generate_series(1,10) n;
$$;
CREATE FUNCTION public.identity_inputs() RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.swell_watch_study_scope_inputs(public.identity_cohort());
$$;
INSERT INTO public.swell_watch_evaluation_policies(epoch,state,policy_hash,policy_values,reviewer,evidence_hash,not_before,expires_at)
VALUES(1,'active',repeat('a',64),'{"volume_caps":{"maximum_candidates_per_region":50,"maximum_recipients_per_event":1000,"maximum_projected_sends_per_window":1000},"provider_failure_hold":{"window_minutes":60,"maximum_failure_rate":0.05,"minimum_samples":20},"staleness":{"maximum_forecast_age_hours":48},"cadence":{"evaluation_interval_minutes":60},"stability":{"minimum_genuine_evaluations":2},"partition_matching":{"maximum_arrival_delta_hours":6,"maximum_period_delta_s":2,"maximum_direction_delta_deg":25}}',
  'fixture',repeat('b',64),now()-interval '10 days',now()+interval '40 days');
SELECT set_config('app.swell_watch_internal_write','on',false);
INSERT INTO public.swell_watch_automation_control(id,state,reason_code) VALUES(gen_random_uuid(),'disabled','identity_fixture');
INSERT INTO public.swell_watch_study_authorities(epoch,state,policy_hash,cohort,scope_inputs,config_hash,provider_contract_ref,evidence_sha256,reviewer,not_before,expires_at,target_days)
VALUES(1,'active',repeat('a',64),public.identity_cohort(),public.identity_inputs(),encode(extensions.digest(jsonb_build_object('policyHash',repeat('a',64),'cohort',public.identity_cohort(),'scopeInputs',public.identity_inputs(),
  'forecastDays',7,'targetDays',30,'providerContractRef','fixture trusted acquisition contract','evidenceSha256',repeat('b',64))::text,'sha256'),'hex'),
  'fixture trusted acquisition contract',repeat('b',64),'fixture',now()-interval '10 days',now()+interval '30 days',30);

CREATE TABLE public.identity_runs(slot integer PRIMARY KEY,run_utc timestamptz,provider_batch_id uuid);
GRANT SELECT ON public.identity_runs TO service_role;
DO $$
DECLARE r record; c record; run_at timestamptz;
BEGIN
  FOR slot IN 0..2 LOOP
    run_at:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'-interval '1 day'+slot*interval '6 hours';
    SELECT * INTO r FROM public.record_swell_watch_provider_run_receipt(public.fixture_study_scopes(
      to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),1.2,1,
      ARRAY(SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(public.identity_cohort()) s)));
    SET LOCAL ROLE service_role;
    SELECT * INTO c FROM public.complete_swell_watch_study_run(r.revision_set_id,repeat('a',64),public.identity_cohort(),public.identity_inputs());
    RESET ROLE;
    INSERT INTO public.identity_runs VALUES(slot,run_at,c.provider_batch_id);
  END LOOP;
END; $$;

-- Fixture components are constant: s1 = 1.2 m / 12 s / 170 deg, s2 = 0.6 m / 9 s / 225 deg (55 deg apart).
CREATE FUNCTION public.identity_resolve(p_slot integer,p_beach integer,p_source_slot text,p_arrival_hours integer,p_peak_hours integer,
  OUT regional_event_id uuid,OUT event_state text) LANGUAGE plpgsql AS $$
DECLARE run record; base timestamptz; physical_key text; impact_hash text;
BEGIN
  SELECT * INTO STRICT run FROM public.identity_runs WHERE slot=p_slot;
  base:=date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  physical_key:=encode(extensions.digest(concat_ws(':',p_slot,p_beach,p_source_slot,p_arrival_hours,p_peak_hours),'sha256'),'hex');
  impact_hash:=encode(extensions.digest(concat_ws(':','impact',p_slot,p_beach,p_source_slot,p_arrival_hours,p_peak_hours),'sha256'),'hex');
  SET LOCAL ROLE service_role;
  SELECT resolved.regional_event_id,resolved.event_state INTO STRICT regional_event_id,event_state
  FROM public.resolve_and_ingest_swell_watch_evaluation(run.provider_batch_id,gen_random_uuid(),gen_random_uuid(),
    ('00000000-0000-4000-8000-'||lpad(p_beach::text,12,'0'))::uuid,'study',
    physical_key,base+make_interval(hours=>p_peak_hours),p_source_slot,
    CASE p_source_slot WHEN 's1' THEN 1.2 ELSE 0.6 END,CASE p_source_slot WHEN 's1' THEN 12 ELSE 9 END,
    CASE p_source_slot WHEN 's1' THEN 170 ELSE 225 END,2,'fixture',repeat('a',64),
    impact_hash,base+make_interval(hours=>p_arrival_hours),base+make_interval(hours=>p_peak_hours)) resolved;
  RESET ROLE;
END; $$;

DO $$
DECLARE swell uuid; cross_sea uuid; second_span uuid; later uuid; r record;
BEGIN
  -- Issuance 1: one swell at two beaches, and a simultaneous swell from another direction.
  SELECT * INTO r FROM public.identity_resolve(0,1,'s1',22,27); swell:=r.regional_event_id;
  PERFORM public.identity_assert(r.event_state='candidate','first sighting is a candidate');
  SELECT * INTO r FROM public.identity_resolve(0,2,'s1',22,27);
  PERFORM public.identity_assert(r.regional_event_id=swell,'one swell across two beaches of a region');
  SELECT * INTO r FROM public.identity_resolve(0,3,'s2',22,27); cross_sea:=r.regional_event_id;
  PERFORM public.identity_assert(cross_sea<>swell,'simultaneous swell from another direction stays separate');

  -- Issuance 2: arrival moves 6 h and the peak 9 h (endpoint rule allocated a new identity here).
  SELECT * INTO r FROM public.identity_resolve(1,1,'s1',16,18);
  PERFORM public.identity_assert(r.regional_event_id=swell,'moved peak keeps the identity');
  PERFORM public.identity_assert(r.event_state='stable','second issuance stabilizes the swell');
  -- A second span of the same issuance and beach cannot share the event; it must not raise either.
  SELECT * INTO r FROM public.identity_resolve(1,1,'s1',22,33); second_span:=r.regional_event_id;
  PERFORM public.identity_assert(second_span NOT IN (swell,cross_sea),'second span of one issuance is its own event');
  SELECT * INTO r FROM public.identity_resolve(1,2,'s1',16,18);
  PERFORM public.identity_assert(r.regional_event_id=swell,'second beach first span keeps the identity');
  -- The blanket same-issuance skip gave the second beach a fourth identity for the identical span.
  SELECT * INTO r FROM public.identity_resolve(1,2,'s1',22,33);
  PERFORM public.identity_assert(r.regional_event_id=second_span,'second span resolves across beaches');
  SELECT * INTO r FROM public.identity_resolve(1,3,'s2',30,31);
  PERFORM public.identity_assert(r.regional_event_id=cross_sea,'span arriving 3 h after the prior peak keeps the identity');

  -- Issuance 3: one coalesced span fits both earlier events; the oldest identity wins and nothing raises.
  SELECT * INTO r FROM public.identity_resolve(2,1,'s1',19,33);
  PERFORM public.identity_assert(r.regional_event_id=swell,'span fitting two events keeps the oldest identity');
  SELECT * INTO r FROM public.identity_resolve(2,1,'s1',19,33);
  PERFORM public.identity_assert(r.regional_event_id=swell,'retry is idempotent');
  -- Same direction and period three days later is a different swell.
  SELECT * INTO r FROM public.identity_resolve(2,4,'s1',96,100); later:=r.regional_event_id;
  PERFORM public.identity_assert(later NOT IN (swell,cross_sea,second_span),'swell days later stays separate');
  SELECT * INTO r FROM public.identity_resolve(2,5,'s1',106,107);
  PERFORM public.identity_assert(r.regional_event_id=later,'arrival exactly at the tolerance after the peak matches');
  SELECT * INTO r FROM public.identity_resolve(2,6,'s1',114,115);
  PERFORM public.identity_assert(r.regional_event_id<>later,'arrival one hour past the tolerance does not match');

  PERFORM public.identity_assert((SELECT count(*) FROM public.swell_watch_regional_events)=5,'five regional events');
  PERFORM public.identity_assert((SELECT count(DISTINCT evaluation_id) FROM public.swell_watch_event_evaluations WHERE regional_event_id=swell)=3,'swell seen in three evaluations');
  PERFORM public.identity_assert((SELECT count(*) FROM public.notification_events)=0,'no notification is created');
END; $$;
