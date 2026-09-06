-- Retain observed zero tuples as unavailable transport slots, never valid swells.
-- Local validation only; production application remains a separately reviewed release operation.
BEGIN;

ALTER TABLE public.swell_watch_provider_run_revision_components
  ADD COLUMN unavailable_reason text,
  DROP CONSTRAINT swell_watch_provider_run_revision_components_period_s_check,
  ADD CONSTRAINT swell_watch_component_availability_check CHECK (
    period_s NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
    AND (
      (unavailable_reason IS NULL AND period_s > 0)
      OR (unavailable_reason IS NOT NULL AND unavailable_reason = 'provider_zero_tuple'
        AND height_m = 0 AND period_s = 0 AND direction_deg = 0)
    )
  );

CREATE OR REPLACE FUNCTION public.record_swell_watch_provider_run_receipt(p_scopes jsonb)
RETURNS TABLE(issuance_id uuid, run_batch_id uuid, revision_set_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_scope jsonb; v_receipt jsonb; v_observation jsonb; v_component jsonb; v_raw jsonb; v_semantic jsonb;
  v_issuance uuid; v_batch uuid; v_scope_id uuid; v_revision uuid; v_revision_set uuid;
  v_run timestamptz; v_run_text text; v_days integer; v_expected_components integer;
  v_scope_hash text; v_revision_set_hash text; v_lat numeric; v_lon numeric; v_request text; v_expected_request text;
  v_grid_lat double precision; v_grid_lon double precision; v_claimed_distance double precision; v_computed_distance double precision; v_lon_delta double precision; v_haversine double precision;
  v_index integer; v_existing_grid jsonb; v_rows integer;
  v_inputs jsonb := '[]'::jsonb; v_new_batch uuid;
BEGIN
  IF jsonb_typeof(p_scopes) <> 'array' OR jsonb_array_length(p_scopes) = 0 THEN RAISE EXCEPTION 'provider receipt scopes are required'; END IF;
  IF octet_length(p_scopes::text) > 33554432 THEN RAISE EXCEPTION 'provider receipt batch exceeds durable limit'; END IF;
  SELECT receipt #>> '{requested,runUtc}' INTO v_run_text FROM jsonb_to_recordset(p_scopes) AS payload("sourcePointId" uuid, receipt jsonb) LIMIT 1;
  IF v_run_text IS NULL OR v_run_text !~ '^\d{4}-\d{2}-\d{2}T(00|06|12|18):00Z$' THEN RAISE EXCEPTION 'provider receipt run is invalid'; END IF;
  v_run := v_run_text::timestamptz;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || v_run_text, 0));
  PERFORM set_config('app.swell_watch_internal_write', 'on', true);

  FOR v_scope IN SELECT value FROM jsonb_array_elements(p_scopes) LOOP
    v_receipt := v_scope->'receipt';
    IF jsonb_typeof(v_receipt) IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_receipt->'rawResponse') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_receipt->'canonicalSemanticPayload') IS DISTINCT FROM 'string'
      OR octet_length(coalesce(v_receipt->>'rawResponse','')) > 524288
      OR octet_length(coalesce(v_receipt->>'canonicalSemanticPayload','')) > 524288 THEN
      RAISE EXCEPTION 'provider receipt content exceeds durable limit';
    END IF;
    v_raw := coalesce((v_receipt->>'rawResponse')::jsonb,'null'::jsonb);
    v_semantic := coalesce((v_receipt->>'canonicalSemanticPayload')::jsonb,'null'::jsonb);
    IF jsonb_typeof(v_scope) IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_scope->'sourcePointId') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_receipt) IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_receipt->'requested') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_receipt #> '{requested,canonicalRequest}') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_receipt->'qualification') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_receipt->'selectedGrid') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_receipt #> '{selectedGrid,policy}') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_receipt->'rawResponse') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_receipt->'canonicalSemanticPayload') IS DISTINCT FROM 'string'
      OR coalesce(v_scope->>'sourcePointId','') !~ '^[a-f0-9-]{36}$'
      OR v_receipt->>'schemaVersion' IS DISTINCT FROM 'open-meteo-single-runs-receipt.v1'
      OR v_receipt->>'parserVersion' IS DISTINCT FROM 'open-meteo-single-runs-receipt.v1'
      OR v_receipt #>> '{qualification,status}' IS DISTINCT FROM 'prototype_unqualified'
      OR v_receipt #>> '{qualification,reason}' IS DISTINCT FROM 'provider_response_does_not_echo_run_and_completion_not_operationally_proven'
      OR v_receipt #>> '{requested,transportProvider}' IS DISTINCT FROM 'open_meteo_single_runs' OR v_receipt #>> '{requested,upstreamModelProvider}' IS DISTINCT FROM 'ncep'
      OR v_receipt #>> '{requested,model}' IS DISTINCT FROM 'ncep_gfswave016' OR v_receipt #>> '{requested,runUtc}' IS DISTINCT FROM v_run_text
      OR v_receipt #>> '{requested,canonicalRequest,method}' IS DISTINCT FROM 'GET' OR v_receipt #>> '{requested,canonicalRequest,requestedRunUtc}' IS DISTINCT FROM v_run_text
      OR coalesce(v_receipt->>'rawResponseSha256','') !~ '^[a-f0-9]{64}$' OR coalesce(v_receipt->>'revisionHash','') !~ '^[a-f0-9]{64}$'
      OR encode(extensions.digest(coalesce(v_receipt->>'rawResponse',''),'sha256'),'hex') IS DISTINCT FROM v_receipt->>'rawResponseSha256'
      OR encode(extensions.digest(coalesce(v_receipt->>'canonicalSemanticPayload',''),'sha256'),'hex') IS DISTINCT FROM v_receipt->>'revisionHash'
      OR jsonb_typeof(v_raw) IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_semantic) IS DISTINCT FROM 'object'
      OR v_semantic IS DISTINCT FROM v_raw - 'generationtime_ms'
      OR NOT (v_raw ?& ARRAY['latitude','longitude','generationtime_ms','utc_offset_seconds','timezone','timezone_abbreviation','elevation','hourly_units','hourly'])
      OR (SELECT count(*) FROM jsonb_object_keys(v_raw)) <> 9
      OR jsonb_typeof(v_raw->'latitude') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_raw->'longitude') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_raw->'generationtime_ms') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_raw->'utc_offset_seconds') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_raw->'timezone') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_raw->'timezone_abbreviation') IS DISTINCT FROM 'string'
      OR jsonb_typeof(v_raw->'elevation') IS DISTINCT FROM 'number'
      OR (v_raw->>'generationtime_ms')::numeric < 0
      OR (v_raw->>'utc_offset_seconds')::numeric IS DISTINCT FROM 0
      OR coalesce(v_raw->>'timezone','') NOT IN ('UTC','GMT')
      OR coalesce(v_raw->>'timezone_abbreviation','') NOT IN ('UTC','GMT')
      OR v_raw->'hourly_units' IS DISTINCT FROM v_receipt->'hourlyUnits'
      OR jsonb_typeof(v_raw->'hourly') IS DISTINCT FROM 'object'
      OR NOT (v_raw->'hourly' ?& ARRAY['time','swell_wave_height','swell_wave_period','swell_wave_direction','secondary_swell_wave_height','secondary_swell_wave_period','secondary_swell_wave_direction'])
      OR (SELECT count(*) FROM jsonb_object_keys(v_raw->'hourly')) <> 7
      OR v_receipt #>> '{selectedGrid,policy,status}' IS DISTINCT FROM 'prototype_local_mapping_policy'
      OR (v_receipt #>> '{selectedGrid,policy,maxDistanceKm}')::numeric IS DISTINCT FROM 30
      OR (v_receipt #>> '{selectedGrid,policy,providerGuarantee}')::boolean IS NOT FALSE
      OR v_receipt->'hourlyUnits' IS DISTINCT FROM '{"time":"iso8601","swell_wave_height":"m","swell_wave_period":"s","swell_wave_direction":"°","secondary_swell_wave_height":"m","secondary_swell_wave_period":"s","secondary_swell_wave_direction":"°"}'::jsonb
      OR jsonb_typeof(v_receipt #> '{selectedGrid,latitude}') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_receipt #> '{selectedGrid,longitude}') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_receipt #> '{selectedGrid,elevationM}') IS DISTINCT FROM 'number'
      OR jsonb_typeof(v_receipt #> '{selectedGrid,distanceFromRequestedKm}') IS DISTINCT FROM 'number'
      OR (v_receipt #>> '{selectedGrid,latitude}')::numeric NOT BETWEEN -90 AND 90
      OR (v_receipt #>> '{selectedGrid,longitude}')::numeric NOT BETWEEN -180 AND 180
      OR (v_receipt #>> '{selectedGrid,elevationM}')::numeric IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
      OR (v_receipt #>> '{selectedGrid,distanceFromRequestedKm}')::numeric IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)
      OR (v_raw->>'latitude')::numeric IS DISTINCT FROM (v_receipt #>> '{selectedGrid,latitude}')::numeric
      OR (v_raw->>'longitude')::numeric IS DISTINCT FROM (v_receipt #>> '{selectedGrid,longitude}')::numeric
      OR (v_raw->>'elevation')::numeric IS DISTINCT FROM (v_receipt #>> '{selectedGrid,elevationM}')::numeric
      OR (v_receipt #>> '{selectedGrid,distanceFromRequestedKm}')::numeric NOT BETWEEN 0 AND 30 THEN RAISE EXCEPTION 'provider receipt envelope is invalid'; END IF;
    v_request := v_receipt #>> '{requested,canonicalRequest,url}';
    IF v_request !~ '^https://single-runs-api\.open-meteo\.com/v1/forecast\?latitude=[^&]+&longitude=[^&]+&models=ncep_gfswave016&hourly=swell_wave_height%2Cswell_wave_period%2Cswell_wave_direction%2Csecondary_swell_wave_height%2Csecondary_swell_wave_period%2Csecondary_swell_wave_direction&run=[^&]+&cell_selection=sea&timezone=UTC&forecast_days=[1-7]$' THEN RAISE EXCEPTION 'provider receipt request is not canonical'; END IF;
    v_lat := (regexp_match(v_request, 'latitude=([^&]+)'))[1]::numeric; v_lon := (regexp_match(v_request, 'longitude=([^&]+)'))[1]::numeric; v_days := (regexp_match(v_request, 'forecast_days=([1-7])$'))[1]::integer;
    IF v_lat NOT BETWEEN -90 AND 90 OR v_lon NOT BETWEEN -180 AND 180 THEN RAISE EXCEPTION 'provider receipt request coordinates are invalid'; END IF;
    v_grid_lat := (v_receipt #>> '{selectedGrid,latitude}')::double precision;
    v_grid_lon := (v_receipt #>> '{selectedGrid,longitude}')::double precision;
    v_claimed_distance := (v_receipt #>> '{selectedGrid,distanceFromRequestedKm}')::double precision;
    v_lon_delta := mod((v_grid_lon - v_lon::double precision + 540)::numeric,360)::double precision - 180;
    v_haversine := sin(radians(v_grid_lat - v_lat::double precision) / 2) ^ 2
      + cos(radians(v_lat::double precision)) * cos(radians(v_grid_lat)) * sin(radians(v_lon_delta) / 2) ^ 2;
    v_computed_distance := 6371 * 2 * atan2(sqrt(v_haversine),sqrt(1 - v_haversine));
    IF v_computed_distance > 30 OR abs(v_computed_distance - v_claimed_distance) > 0.001 THEN RAISE EXCEPTION 'provider receipt selected-grid distance is invalid'; END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_each(v_raw->'hourly') field
      WHERE jsonb_typeof(field.value) IS DISTINCT FROM 'array' OR jsonb_array_length(field.value) <> v_days * 24
    ) THEN RAISE EXCEPTION 'provider raw response scope is incomplete'; END IF;
    v_expected_request := format('https://single-runs-api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&models=ncep_gfswave016&hourly=swell_wave_height%%2Cswell_wave_period%%2Cswell_wave_direction%%2Csecondary_swell_wave_height%%2Csecondary_swell_wave_period%%2Csecondary_swell_wave_direction&run=%s&cell_selection=sea&timezone=UTC&forecast_days=%s', v_lat::text, v_lon::text, replace(to_char(v_run AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI'), ':', '%3A'), v_days);
    IF v_request IS DISTINCT FROM v_expected_request OR jsonb_typeof(v_receipt->'observations') IS DISTINCT FROM 'array' OR jsonb_array_length(v_receipt->'observations') <> v_days * 24 THEN RAISE EXCEPTION 'provider receipt scope is invalid'; END IF;
    v_index := 0;
    FOR v_observation IN SELECT value FROM jsonb_array_elements(v_receipt->'observations') LOOP
      IF jsonb_typeof(v_observation) IS DISTINCT FROM 'object'
        OR NOT (v_observation ?& ARRAY['providerForecastAt','forecastAtUtc','timeProvenance','components'])
        OR v_observation->>'providerForecastAt' IS DISTINCT FROM to_char(v_run + make_interval(hours => v_index), 'YYYY-MM-DD"T"HH24:MI') OR v_observation->>'forecastAtUtc' IS DISTINCT FROM (v_observation->>'providerForecastAt') || 'Z'
        OR jsonb_typeof(v_raw->'hourly'->'time'->v_index) IS DISTINCT FROM 'string'
        OR v_observation->>'providerForecastAt' IS DISTINCT FROM (v_raw->'hourly'->'time'->>v_index)
        OR v_observation #>> '{timeProvenance,field}' IS DISTINCT FROM 'time' OR v_observation #>> '{timeProvenance,timezone}' IS DISTINCT FROM 'UTC'
        OR jsonb_typeof(v_observation->'components') IS DISTINCT FROM 'array' OR jsonb_array_length(v_observation->'components') <> 2
        OR v_observation->'components'->0->>'sourceSlot' IS DISTINCT FROM 's1' OR v_observation->'components'->1->>'sourceSlot' IS DISTINCT FROM 's2' THEN RAISE EXCEPTION 'provider receipt slots are not exact'; END IF;
      FOR v_component IN SELECT value FROM jsonb_array_elements(v_observation->'components') LOOP
        IF jsonb_typeof(v_component) IS DISTINCT FROM 'object'
          OR NOT (v_component ?& ARRAY['sourceSlot','heightM','periodS','directionDeg','rawFieldProvenance'])
          OR jsonb_typeof(v_component->'heightM') IS DISTINCT FROM 'number' OR jsonb_typeof(v_component->'periodS') IS DISTINCT FROM 'number' OR jsonb_typeof(v_component->'directionDeg') IS DISTINCT FROM 'number'
          OR (v_component->>'heightM')::numeric < 0 OR NOT (
            (NOT (v_component ? 'unavailableReason') AND (v_component->>'periodS')::numeric > 0)
            OR (v_component->>'unavailableReason' IS NOT DISTINCT FROM 'provider_zero_tuple'
              AND (v_component->>'heightM')::numeric = 0 AND (v_component->>'periodS')::numeric = 0 AND (v_component->>'directionDeg')::numeric = 0)
          ) OR (v_component->>'directionDeg')::numeric < 0 OR (v_component->>'directionDeg')::numeric >= 360
          OR (v_component->>'sourceSlot'='s1' AND (jsonb_typeof(v_raw->'hourly'->'swell_wave_height'->v_index) IS DISTINCT FROM 'number' OR jsonb_typeof(v_raw->'hourly'->'swell_wave_period'->v_index) IS DISTINCT FROM 'number' OR jsonb_typeof(v_raw->'hourly'->'swell_wave_direction'->v_index) IS DISTINCT FROM 'number'))
          OR (v_component->>'sourceSlot'='s2' AND (jsonb_typeof(v_raw->'hourly'->'secondary_swell_wave_height'->v_index) IS DISTINCT FROM 'number' OR jsonb_typeof(v_raw->'hourly'->'secondary_swell_wave_period'->v_index) IS DISTINCT FROM 'number' OR jsonb_typeof(v_raw->'hourly'->'secondary_swell_wave_direction'->v_index) IS DISTINCT FROM 'number'))
          OR (v_component->>'sourceSlot'='s1' AND ((v_component->>'heightM')::numeric IS DISTINCT FROM (v_raw->'hourly'->'swell_wave_height'->>v_index)::numeric OR (v_component->>'periodS')::numeric IS DISTINCT FROM (v_raw->'hourly'->'swell_wave_period'->>v_index)::numeric OR (v_component->>'directionDeg')::numeric IS DISTINCT FROM (v_raw->'hourly'->'swell_wave_direction'->>v_index)::numeric))
          OR (v_component->>'sourceSlot'='s2' AND ((v_component->>'heightM')::numeric IS DISTINCT FROM (v_raw->'hourly'->'secondary_swell_wave_height'->>v_index)::numeric OR (v_component->>'periodS')::numeric IS DISTINCT FROM (v_raw->'hourly'->'secondary_swell_wave_period'->>v_index)::numeric OR (v_component->>'directionDeg')::numeric IS DISTINCT FROM (v_raw->'hourly'->'secondary_swell_wave_direction'->>v_index)::numeric))
          OR (v_component->>'sourceSlot' = 's1' AND v_component->'rawFieldProvenance' IS DISTINCT FROM '{"height":"swell_wave_height","period":"swell_wave_period","direction":"swell_wave_direction"}'::jsonb)
          OR (v_component->>'sourceSlot' = 's2' AND v_component->'rawFieldProvenance' IS DISTINCT FROM '{"height":"secondary_swell_wave_height","period":"secondary_swell_wave_period","direction":"secondary_swell_wave_direction"}'::jsonb) THEN RAISE EXCEPTION 'provider receipt component provenance is invalid'; END IF;
      END LOOP;
      v_index := v_index + 1;
    END LOOP;
  END LOOP;

  SELECT count(*), count(DISTINCT payload."sourcePointId"), sum(jsonb_array_length(payload.receipt->'observations') * 2), encode(extensions.digest(jsonb_agg(jsonb_build_object('sourcePointId', payload."sourcePointId", 'request', payload.receipt #> '{requested,canonicalRequest}') ORDER BY payload."sourcePointId")::text, 'sha256'), 'hex')
  INTO v_rows, v_index, v_expected_components, v_scope_hash FROM jsonb_to_recordset(p_scopes) AS payload("sourcePointId" uuid, receipt jsonb);
  IF v_rows <> v_index THEN RAISE EXCEPTION 'provider receipt scope contains duplicate source points'; END IF;
  INSERT INTO public.swell_watch_provider_run_issuances (transport_provider, model, run_utc, parser_version, upstream_model_provider) VALUES ('open_meteo_single_runs','ncep_gfswave016',v_run,'open-meteo-single-runs-receipt.v1','ncep') ON CONFLICT (transport_provider, model, run_utc) DO NOTHING RETURNING id INTO v_issuance;
  IF v_issuance IS NULL THEN SELECT id INTO v_issuance FROM public.swell_watch_provider_run_issuances WHERE transport_provider='open_meteo_single_runs' AND model='ncep_gfswave016' AND run_utc=v_run; END IF;
  v_new_batch := gen_random_uuid();
  INSERT INTO public.swell_watch_provider_run_batches AS batch (id, issuance_id, scope_hash, expected_component_count) VALUES (v_new_batch,v_issuance,v_scope_hash,v_expected_components) ON CONFLICT ON CONSTRAINT swell_watch_provider_run_batches_issuance_id_key DO NOTHING RETURNING batch.id INTO v_batch;
  IF v_batch IS NULL THEN
    SELECT batch.id INTO v_batch FROM public.swell_watch_provider_run_batches batch WHERE batch.issuance_id=v_issuance;
    IF NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_batches WHERE id=v_batch AND scope_hash=v_scope_hash AND expected_component_count=v_expected_components) THEN RAISE EXCEPTION 'provider receipt scope conflicts with frozen batch'; END IF;
  END IF;

  FOR v_scope IN SELECT value FROM jsonb_array_elements(p_scopes) LOOP
    v_receipt := v_scope->'receipt'; v_request := v_receipt #>> '{requested,canonicalRequest,url}'; v_lat := (regexp_match(v_request, 'latitude=([^&]+)'))[1]::numeric; v_lon := (regexp_match(v_request, 'longitude=([^&]+)'))[1]::numeric; v_days := (regexp_match(v_request, 'forecast_days=([1-7])$'))[1]::integer;
    INSERT INTO public.swell_watch_provider_run_batch_scopes (batch_id,source_point_id,canonical_request,requested_lat,requested_lon,forecast_days) VALUES (v_batch,(v_scope->>'sourcePointId')::uuid,v_receipt #> '{requested,canonicalRequest}',v_lat,v_lon,v_days) ON CONFLICT (batch_id,source_point_id) DO NOTHING RETURNING id INTO v_scope_id;
    IF v_scope_id IS NULL THEN SELECT id INTO v_scope_id FROM public.swell_watch_provider_run_batch_scopes WHERE batch_id=v_batch AND source_point_id=(v_scope->>'sourcePointId')::uuid; IF NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_batch_scopes WHERE id=v_scope_id AND canonical_request=v_receipt #> '{requested,canonicalRequest}') THEN RAISE EXCEPTION 'provider receipt scope conflicts with frozen batch'; END IF; END IF;
    v_semantic := (v_receipt->>'canonicalSemanticPayload')::jsonb;
    INSERT INTO public.swell_watch_provider_run_revisions (scope_id,semantic_revision_hash,semantic_payload,selected_grid) VALUES (v_scope_id,v_receipt->>'revisionHash',v_semantic,v_receipt->'selectedGrid') ON CONFLICT (scope_id,semantic_revision_hash) DO NOTHING RETURNING id INTO v_revision;
    IF v_revision IS NULL THEN SELECT id,selected_grid INTO v_revision,v_existing_grid FROM public.swell_watch_provider_run_revisions WHERE scope_id=v_scope_id AND semantic_revision_hash=v_receipt->>'revisionHash' AND semantic_payload=v_semantic; IF v_revision IS NULL OR v_existing_grid IS DISTINCT FROM v_receipt->'selectedGrid' THEN RAISE EXCEPTION 'provider receipt revision hash conflicts with its payload'; END IF;
    END IF;
    FOR v_observation IN SELECT value FROM jsonb_array_elements(v_receipt->'observations') LOOP
      FOR v_component IN SELECT value FROM jsonb_array_elements(v_observation->'components') LOOP
        INSERT INTO public.swell_watch_provider_run_revision_components (revision_id,provider_forecast_at,forecast_at,source_slot,height_m,period_s,direction_deg,raw_field_provenance,time_provenance,unavailable_reason)
        VALUES (v_revision,v_observation->>'providerForecastAt',(v_observation->>'forecastAtUtc')::timestamptz,v_component->>'sourceSlot',(v_component->>'heightM')::numeric,(v_component->>'periodS')::numeric,(v_component->>'directionDeg')::numeric,v_component->'rawFieldProvenance',v_observation->'timeProvenance',v_component->>'unavailableReason')
        ON CONFLICT (revision_id,forecast_at,source_slot) DO NOTHING;
        IF NOT EXISTS (
          SELECT 1 FROM public.swell_watch_provider_run_revision_components persisted
          WHERE persisted.revision_id=v_revision
            AND persisted.provider_forecast_at=v_observation->>'providerForecastAt'
            AND persisted.forecast_at=(v_observation->>'forecastAtUtc')::timestamptz
            AND persisted.source_slot=v_component->>'sourceSlot'
            AND persisted.height_m=(v_component->>'heightM')::numeric
            AND persisted.period_s=(v_component->>'periodS')::numeric
            AND persisted.direction_deg=(v_component->>'directionDeg')::numeric
            AND persisted.raw_field_provenance=v_component->'rawFieldProvenance'
            AND persisted.time_provenance=v_observation->'timeProvenance'
            AND persisted.unavailable_reason IS NOT DISTINCT FROM v_component->>'unavailableReason'
        ) THEN RAISE EXCEPTION 'provider receipt revision hash conflicts with its components'; END IF;
      END LOOP;
    END LOOP;
    INSERT INTO public.swell_watch_provider_run_revision_raw_responses (revision_id,raw_response_sha256,raw_response)
    VALUES (v_revision,v_receipt->>'rawResponseSha256',v_receipt->>'rawResponse') ON CONFLICT DO NOTHING;
    SELECT count(*) INTO v_rows FROM public.swell_watch_provider_run_revision_components WHERE revision_id=v_revision;
    IF v_rows <> v_days * 24 * 2 THEN RAISE EXCEPTION 'provider receipt component count is incomplete'; END IF;
    v_inputs := v_inputs || jsonb_build_array(jsonb_build_object('scope',v_scope_id,'revision',v_revision));
  END LOOP;
  IF jsonb_array_length(v_inputs) <> (SELECT count(*) FROM public.swell_watch_provider_run_batch_scopes WHERE batch_id=v_batch) THEN RAISE EXCEPTION 'provider receipt does not satisfy the frozen batch scope'; END IF;
  SELECT encode(extensions.digest(jsonb_agg(item ORDER BY item->>'scope')::text, 'sha256'),'hex') INTO v_revision_set_hash FROM jsonb_array_elements(v_inputs) item;
  INSERT INTO public.swell_watch_provider_run_revision_sets (batch_id,revision_number,revision_set_hash)
  VALUES (
    v_batch,
    (SELECT coalesce(max(candidate.revision_number), 0) + 1 FROM public.swell_watch_provider_run_revision_sets candidate WHERE candidate.batch_id = v_batch),
    v_revision_set_hash
  )
  ON CONFLICT (batch_id,revision_set_hash) DO NOTHING RETURNING id INTO v_revision_set;
  IF v_revision_set IS NULL THEN SELECT id INTO v_revision_set FROM public.swell_watch_provider_run_revision_sets WHERE batch_id=v_batch AND revision_set_hash=v_revision_set_hash;
  ELSE INSERT INTO public.swell_watch_provider_run_revision_set_members (revision_set_id,scope_id,revision_id) SELECT v_revision_set,(item->>'scope')::uuid,(item->>'revision')::uuid FROM jsonb_array_elements(v_inputs) item; END IF;
  RETURN QUERY SELECT v_issuance,v_batch,v_revision_set;
END;
$$;


CREATE OR REPLACE FUNCTION public.read_swell_watch_attested_components(p_provider_batch_id uuid,p_source_point_id uuid,p_forecast_at timestamptz)
RETURNS TABLE(evaluation_id text,source_slot text,height_m numeric,period_s numeric,direction_deg numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.swell_watch_provider_evidence_is_current(p_provider_batch_id) THEN
    RAISE EXCEPTION 'current provider attestation is required';
  END IF;
  RETURN QUERY SELECT 'genuine_completed:' || completed.batch_id,component.source_slot,
    component.height_m,component.period_s,component.direction_deg
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_revision_set_members member ON member.revision_set_id=completed.revision_set_id
  JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id=member.scope_id
  JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id=member.revision_id
  WHERE completed.id=p_provider_batch_id AND scope.source_point_id=p_source_point_id AND component.forecast_at=p_forecast_at AND component.unavailable_reason IS NULL
  ORDER BY component.source_slot;
END;
$$;

CREATE OR REPLACE FUNCTION public.swell_watch_verify_provider_batch_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_completed_id uuid; v_revision_set_id uuid; v_evaluation text;
BEGIN
  IF NEW.identity_kind = 'synthetic_fixture' THEN
    IF NEW.provider_batch_id IS NOT NULL THEN RAISE EXCEPTION 'synthetic fixtures cannot use provider batches'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.identity_kind <> 'genuine_completed' OR current_setting('app.swell_watch_verified_batch_id', true) IS NULL THEN
    RAISE EXCEPTION 'genuine completed observations require a verified provider batch';
  END IF;
  NEW.provider_batch_id := current_setting('app.swell_watch_verified_batch_id', true)::uuid;
  SELECT completed.id, completed.revision_set_id, 'genuine_completed:' || batch.id INTO v_completed_id, v_revision_set_id, v_evaluation
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_batches batch ON batch.id = completed.batch_id
  WHERE completed.id = NEW.provider_batch_id;
  IF v_completed_id IS NULL OR NEW.evaluation_id IS DISTINCT FROM v_evaluation OR NEW.provider <> 'open_meteo'
    OR NOT EXISTS (
      SELECT 1
      FROM public.swell_watch_provider_run_revision_sets current_set
      WHERE current_set.id = v_revision_set_id
        AND current_set.revision_number = (
          SELECT max(candidate.revision_number)
          FROM public.swell_watch_provider_run_revision_sets candidate
          WHERE candidate.batch_id = current_set.batch_id
        )
    )
    OR NOT EXISTS (
      SELECT 1
      FROM public.swell_watch_provider_run_attestations accepted
      WHERE accepted.revision_set_id = v_revision_set_id
        AND accepted.state = 'accepted'
        AND NOT EXISTS (
          SELECT 1
          FROM public.swell_watch_provider_run_attestations revoked
          WHERE revoked.state = 'revoked'
            AND revoked.revokes_attestation_id = accepted.id
        )
    )
    OR NOT EXISTS (
      SELECT 1 FROM public.swell_watch_provider_run_revision_set_members member
      JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id = member.scope_id
      JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id = member.revision_id
      WHERE member.revision_set_id = v_revision_set_id AND scope.source_point_id = NEW.source_point_id
        AND component.unavailable_reason IS NULL
        AND component.forecast_at = NEW.forecast_at AND component.source_slot = NEW.source_slot
        AND component.height_m = NEW.height_m AND component.period_s = NEW.period_s AND component.direction_deg = NEW.direction_deg
    ) THEN RAISE EXCEPTION 'genuine completed observation does not match provider batch'; END IF;
  RETURN NEW;
END;
$$;


COMMIT;

