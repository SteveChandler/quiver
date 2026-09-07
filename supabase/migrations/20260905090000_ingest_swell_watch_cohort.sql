-- Atomic multi-beach ingestion, retaining existing per-impact validation.
-- Rollback: revoke/drop this function with cohort processing disabled.
BEGIN;
CREATE FUNCTION public.ingest_swell_watch_cohort(p_impacts jsonb)
RETURNS TABLE(ordinal integer,regional_event_id uuid,event_state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE regions text[]; v_batch_id uuid; item jsonb; position integer := 0;
BEGIN
  IF jsonb_typeof(p_impacts) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'impacts must be an array'; END IF;
  -- ponytail: bounded transaction; split via a durable staging protocol if 1,000 impacts are needed.
  IF jsonb_array_length(p_impacts) NOT BETWEEN 1 AND 1000 THEN RAISE EXCEPTION 'invalid cohort impact count'; END IF;
  v_batch_id := (p_impacts->0->>'p_provider_batch_id')::uuid;
  IF v_batch_id IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(p_impacts) value
    WHERE jsonb_typeof(value) IS DISTINCT FROM 'object'
      OR value->>'p_provider_batch_id' IS DISTINCT FROM p_impacts->0->>'p_provider_batch_id'
      OR value->>'p_policy_hash' IS DISTINCT FROM p_impacts->0->>'p_policy_hash'
      OR value->>'p_region_key' IS NULL OR char_length(btrim(value->>'p_region_key')) NOT BETWEEN 1 AND 100) THEN
    RAISE EXCEPTION 'invalid cohort scope';
  END IF;
  SELECT array_agg(DISTINCT value->>'p_region_key' ORDER BY value->>'p_region_key') INTO regions
    FROM jsonb_array_elements(p_impacts) value;
  -- Reserve every region/event/provider in the same order as single-impact ingestion.
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-region:' || region,0))
    FROM unnest(regions) region ORDER BY region;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || event.id::text,0))
    FROM public.swell_watch_regional_events event WHERE event.region_key=ANY(regions) ORDER BY event.id;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' ||
    to_char(runs.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0))
  FROM (
    SELECT issuance.run_utc FROM public.swell_watch_provider_run_completed_batches completed
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE completed.id=v_batch_id
    UNION
    SELECT issuance.run_utc FROM public.swell_watch_event_impacts association
    JOIN public.swell_watch_regional_events event ON event.id=association.regional_event_id
    JOIN public.swell_watch_beach_impacts impact ON impact.id=association.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE event.region_key=ANY(regions)
  ) runs ORDER BY runs.run_utc;
  FOR item IN SELECT value FROM jsonb_array_elements(p_impacts) WITH ORDINALITY ORDER BY ordinality LOOP
    RETURN QUERY SELECT position,result.regional_event_id,result.event_state
      FROM public.ingest_swell_watch_run(jsonb_build_array(item)) result;
    IF NOT FOUND THEN RAISE EXCEPTION 'cohort identity was not returned'; END IF;
    position := position + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_swell_watch_cohort(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_swell_watch_cohort(jsonb) TO service_role;
COMMIT;
