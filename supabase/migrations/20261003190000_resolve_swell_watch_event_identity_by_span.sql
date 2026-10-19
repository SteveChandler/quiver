-- Swell Watch event identity: one physical swell resolves to one regional event across issuances.
-- Measured 2026-09-17..2026-10-03: 26 past regional events for about 12 swells; 20 seen in one evaluation only.
-- Three resolver rules caused it (details: docs/operations/swell-watch-event-identity-20261003.md):
--   1. arrival AND peak each had to stay within maximum_arrival_delta_hours; the peak of a flat swell moves further.
--   2. the second span of one issuance at one beach skipped matching entirely and always took a fresh identity.
--   3. two matching events raised 'ambiguous regional identity', which fails the whole cohort transaction.
-- Thresholds, policy rows, authority rows and stability rules are unchanged. No data is rewritten.
-- Reviewed production body hash: pre b5f3300dde131554862219403c59e87b97f06df0e384fe9db5dc0b733b6646c4
--   post f31a07b99d8ec82ffea8209ec15f8bb0037624a6880db6c9f409fff5f5ddf002 (computed offline from the production definition; enforced below).
-- Rollback: docs/operations/swell-watch-event-identity-rollback.sql
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

DO $$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
END $$;

DO $amend$
DECLARE definition text; pre_hash text; pair text[]; pairs text[][] := ARRAY[
  ARRAY[$o$v_max_direction numeric; v_same_evaluation_beach boolean;$o$,
$n$v_max_direction numeric;$n$],
  ARRAY[$o$  SELECT EXISTS(SELECT 1 FROM public.swell_watch_event_impacts association
    JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    WHERE association.evaluation_id=v_evaluation AND association.beach_id=p_source_point_id
      AND observation.provider_batch_id=p_provider_batch_id AND observation.id IS DISTINCT FROM p_observation_id) INTO v_same_evaluation_beach;
$o$,
$n$$n$],
  ARRAY[$o$    IF NOT v_same_evaluation_beach AND v_reference.provider='open_meteo' AND abs(v_reference.period_s-p_period_s)<=v_max_period
      AND least(abs(v_reference.direction_deg-p_direction_deg),360-abs(v_reference.direction_deg-p_direction_deg))<=v_max_direction
      AND abs(extract(epoch FROM v_reference.arrival_at-p_arrival_at))<=v_max_hours*3600
      AND abs(extract(epoch FROM v_reference.peak_at-p_peak_at))<=v_max_hours*3600 THEN
$o$,
$n$    -- One swell is one arrival-to-peak span. Issuances move either endpoint, so compare the spans.
    IF v_reference.provider='open_meteo' AND abs(v_reference.period_s-p_period_s)<=v_max_period
      AND least(abs(v_reference.direction_deg-p_direction_deg),360-abs(v_reference.direction_deg-p_direction_deg))<=v_max_direction
      AND extract(epoch FROM greatest(p_arrival_at-v_reference.peak_at,v_reference.arrival_at-p_peak_at))<=v_max_hours*3600 THEN
$n$],
  ARRAY[$o$        CONTINUE;
      END IF;
      IF NOT v_reference.regional_event_id=ANY(v_matches) THEN
$o$,
$n$        CONTINUE;
      END IF;
      -- An event holds one span per issuance per beach; a second span there is another swell.
      IF EXISTS(SELECT 1 FROM public.swell_watch_event_impacts association
        JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id
        JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
        WHERE association.regional_event_id=v_reference.regional_event_id AND association.evaluation_id=v_evaluation
          AND association.beach_id=p_source_point_id
          AND (observation.forecast_at,observation.source_slot) IS DISTINCT FROM (p_forecast_at,p_source_slot)) THEN
        CONTINUE;
      END IF;
      IF NOT v_reference.regional_event_id=ANY(v_matches) THEN
$n$],
  ARRAY[$o$  IF cardinality(v_matches)>1 THEN RAISE EXCEPTION 'ambiguous regional identity'; END IF;
  v_event := coalesce(v_matches[1],gen_random_uuid());
$o$,
$n$  -- Earlier fragments can fit one span. The swell keeps its oldest identity, so announcement dedupe holds
  -- and one ambiguous feed cannot fail the whole cohort transaction.
  v_event := coalesce(v_retry_ids[1],(SELECT evaluation.regional_event_id FROM public.swell_watch_event_evaluations evaluation
    WHERE evaluation.regional_event_id=ANY(v_matches) ORDER BY evaluation.evaluated_at,evaluation.regional_event_id LIMIT 1),gen_random_uuid());
$n$]
];
BEGIN
  SELECT pg_get_functiondef('public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz)'::regprocedure) INTO definition;
  pre_hash := encode(extensions.digest(definition,'sha256'),'hex');
  IF position($m$greatest(p_arrival_at-v_reference.peak_at,v_reference.arrival_at-p_peak_at)$m$ IN definition)>0 THEN RETURN; END IF;
  FOREACH pair SLICE 1 IN ARRAY pairs LOOP
    IF (length(definition)-length(replace(definition,pair[1],'')))/length(pair[1])<>1 THEN
      RAISE EXCEPTION 'event identity: resolver differs from reviewed baseline at %',left(pair[1],60);
    END IF;
    definition := replace(definition,pair[1],pair[2]);
  END LOOP;
  EXECUTE definition;
  -- Disposable PostgreSQL 15 renders a different header; pin the exact result only for the reviewed production text.
  IF pre_hash='b5f3300dde131554862219403c59e87b97f06df0e384fe9db5dc0b733b6646c4' AND encode(extensions.digest(pg_get_functiondef('public.resolve_and_ingest_swell_watch_evaluation(uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz)'::regprocedure),'sha256'),'hex')<>'f31a07b99d8ec82ffea8209ec15f8bb0037624a6880db6c9f409fff5f5ddf002' THEN
    RAISE EXCEPTION 'event identity: resolver definition hash mismatch';
  END IF;
END;
$amend$;

COMMIT;
