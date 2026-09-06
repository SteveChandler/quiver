-- Local coordinator transaction boundary; no tables or release authority added.
-- Rollback: revoke/drop this RPC while keeping run processing disabled.
BEGIN;

CREATE FUNCTION public.ingest_swell_watch_run(p_impacts jsonb)
RETURNS TABLE(ordinal integer,regional_event_id uuid,event_state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE item jsonb; args record; position integer := 0;
BEGIN
  IF jsonb_typeof(p_impacts) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'run impacts must be an array';
  END IF;
  IF jsonb_array_length(p_impacts) NOT BETWEEN 1 AND 336 THEN
    RAISE EXCEPTION 'invalid run impact count';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_impacts) WITH ORDINALITY ORDER BY ordinality LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR item->>'p_provider_batch_id' IS DISTINCT FROM p_impacts->0->>'p_provider_batch_id'
      OR item->>'p_source_point_id' IS DISTINCT FROM p_impacts->0->>'p_source_point_id'
      OR item->>'p_region_key' IS DISTINCT FROM p_impacts->0->>'p_region_key'
      OR item->>'p_policy_hash' IS DISTINCT FROM p_impacts->0->>'p_policy_hash' THEN
      RAISE EXCEPTION 'mixed run impact scope';
    END IF;
    SELECT * INTO args FROM jsonb_to_record(item) AS parsed(
      p_provider_batch_id uuid,p_observation_id uuid,p_impact_id uuid,p_source_point_id uuid,
      p_region_key text,p_physical_key text,p_forecast_at timestamptz,p_source_slot text,
      p_height_m numeric,p_period_s numeric,p_direction_deg numeric,p_projected_face_height_ft numeric,
      p_policy_id text,p_policy_hash text,p_impact_hash text,p_arrival_at timestamptz,p_peak_at timestamptz
    );
    RETURN QUERY SELECT position,result.regional_event_id,result.event_state
      FROM public.resolve_and_ingest_swell_watch_evaluation(
        args.p_provider_batch_id,args.p_observation_id,args.p_impact_id,args.p_source_point_id,
        args.p_region_key,args.p_physical_key,args.p_forecast_at,args.p_source_slot,
        args.p_height_m,args.p_period_s,args.p_direction_deg,args.p_projected_face_height_ft,
        args.p_policy_id,args.p_policy_hash,args.p_impact_hash,args.p_arrival_at,args.p_peak_at
      ) result;
    IF NOT FOUND THEN RAISE EXCEPTION 'run impact identity was not returned'; END IF;
    position := position + 1;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.ingest_swell_watch_run(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ingest_swell_watch_run(jsonb) TO service_role;
COMMIT;
