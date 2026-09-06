-- Phase 26: immutable local-only receipts for pinned Open-Meteo Single Runs.
-- Recording a receipt never qualifies a provider run; completion needs a separate attestation.
BEGIN;

CREATE TABLE public.swell_watch_provider_run_issuances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transport_provider text NOT NULL CHECK (transport_provider = 'open_meteo_single_runs'),
  model text NOT NULL CHECK (model = 'ncep_gfswave016'),
  run_utc timestamptz NOT NULL,
  parser_version text NOT NULL CHECK (parser_version = 'open-meteo-single-runs-receipt.v1'),
  upstream_model_provider text NOT NULL CHECK (upstream_model_provider = 'ncep'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (transport_provider, model, run_utc)
);

CREATE TABLE public.swell_watch_provider_run_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issuance_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_issuances(id),
  scope_hash text NOT NULL CHECK (scope_hash ~ '^[a-f0-9]{64}$'),
  expected_component_count integer NOT NULL CHECK (expected_component_count > 0 AND expected_component_count % 2 = 0),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (issuance_id)
);

CREATE TABLE public.swell_watch_provider_run_batch_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_batches(id),
  source_point_id uuid NOT NULL REFERENCES public.beaches(id),
  canonical_request jsonb NOT NULL,
  requested_lat numeric NOT NULL CHECK (requested_lat BETWEEN -90 AND 90),
  requested_lon numeric NOT NULL CHECK (requested_lon BETWEEN -180 AND 180),
  forecast_days integer NOT NULL CHECK (forecast_days BETWEEN 1 AND 7),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (batch_id, source_point_id)
);

CREATE TABLE public.swell_watch_provider_run_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_batch_scopes(id),
  semantic_revision_hash text NOT NULL CHECK (semantic_revision_hash ~ '^[a-f0-9]{64}$'),
  semantic_payload jsonb NOT NULL,
  selected_grid jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (scope_id, semantic_revision_hash)
);

CREATE TABLE public.swell_watch_provider_run_revision_raw_responses (
  revision_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_revisions(id),
  raw_response_sha256 text NOT NULL CHECK (raw_response_sha256 ~ '^[a-f0-9]{64}$'),
  raw_response text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK (octet_length(raw_response) <= 524288),
  CHECK (encode(extensions.digest(raw_response,'sha256'),'hex') = raw_response_sha256),
  PRIMARY KEY (revision_id, raw_response_sha256)
);

CREATE TABLE public.swell_watch_provider_run_revision_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_revisions(id),
  provider_forecast_at text NOT NULL,
  forecast_at timestamptz NOT NULL,
  source_slot text NOT NULL CHECK (source_slot IN ('s1', 's2')),
  height_m numeric NOT NULL CHECK (height_m >= 0 AND height_m NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  period_s numeric NOT NULL CHECK (period_s > 0 AND period_s NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  direction_deg numeric NOT NULL CHECK (direction_deg >= 0 AND direction_deg < 360),
  raw_field_provenance jsonb NOT NULL,
  time_provenance jsonb NOT NULL,
  UNIQUE (revision_id, forecast_at, source_slot)
);

CREATE TABLE public.swell_watch_provider_run_revision_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_batches(id),
  revision_number integer NOT NULL CHECK (revision_number > 0),
  revision_set_hash text NOT NULL CHECK (revision_set_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (batch_id, revision_number),
  UNIQUE (batch_id, revision_set_hash)
);

CREATE TABLE public.swell_watch_provider_run_revision_set_members (
  revision_set_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_revision_sets(id),
  scope_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_batch_scopes(id),
  revision_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_revisions(id),
  PRIMARY KEY (revision_set_id, scope_id),
  UNIQUE (revision_set_id, revision_id)
);

CREATE TABLE public.swell_watch_provider_run_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_set_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_revision_sets(id),
  state text NOT NULL CHECK (state IN ('accepted', 'rejected', 'revoked')),
  reviewer text NOT NULL CHECK (char_length(reviewer) BETWEEN 1 AND 200),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  provider_contract_ref text NOT NULL CHECK (char_length(provider_contract_ref) BETWEEN 1 AND 500),
  revokes_attestation_id uuid REFERENCES public.swell_watch_provider_run_attestations(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  CHECK ((state = 'revoked') = (revokes_attestation_id IS NOT NULL))
);

CREATE TABLE public.swell_watch_provider_run_completed_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_batches(id),
  revision_set_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_revision_sets(id),
  created_at timestamptz NOT NULL DEFAULT transaction_timestamp(),
  UNIQUE (revision_set_id)
);

ALTER TABLE public.swell_watch_observations ADD COLUMN provider_batch_id uuid REFERENCES public.swell_watch_provider_run_completed_batches(id);

CREATE OR REPLACE FUNCTION public.swell_watch_provider_run_append_only_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') OR current_setting('app.swell_watch_internal_write', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'provider run evidence is append-only';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.swell_watch_provider_run_attestation_subject_trigger()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_set uuid; v_state text; v_run_text text;
BEGIN
  SELECT to_char(issuance.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"') INTO v_run_text
  FROM public.swell_watch_provider_run_revision_sets revision_set
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=revision_set.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE revision_set.id=NEW.revision_set_id;
  IF v_run_text IS NULL THEN RAISE EXCEPTION 'attestation revision set does not exist'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || v_run_text,0));
  IF NEW.state <> 'revoked' THEN RETURN NEW; END IF;
  SELECT revision_set_id, state INTO v_set, v_state FROM public.swell_watch_provider_run_attestations WHERE id = NEW.revokes_attestation_id;
  IF v_set IS DISTINCT FROM NEW.revision_set_id OR v_state NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'attestation revocation must reference the same revision set';
  END IF;
  RETURN NEW;
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
        AND component.forecast_at = NEW.forecast_at AND component.source_slot = NEW.source_slot
        AND component.height_m = NEW.height_m AND component.period_s = NEW.period_s AND component.direction_deg = NEW.direction_deg
    ) THEN RAISE EXCEPTION 'genuine completed observation does not match provider batch'; END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER swell_watch_provider_run_issuances_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_issuances FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_batches_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_batches FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_scopes_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_batch_scopes FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_revisions_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_revisions FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_raw_responses_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_revision_raw_responses FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_components_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_revision_components FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_revision_sets_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_revision_sets FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_revision_members_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_revision_set_members FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_attestations_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_attestations FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_provider_run_attestation_subject BEFORE INSERT ON public.swell_watch_provider_run_attestations FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_attestation_subject_trigger();
CREATE TRIGGER swell_watch_provider_run_completed_append_only BEFORE INSERT OR UPDATE OR DELETE ON public.swell_watch_provider_run_completed_batches FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_observations_verify_provider_batch BEFORE INSERT ON public.swell_watch_observations FOR EACH ROW EXECUTE FUNCTION public.swell_watch_verify_provider_batch_trigger();

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
          OR (v_component->>'heightM')::numeric < 0 OR (v_component->>'periodS')::numeric <= 0 OR (v_component->>'directionDeg')::numeric < 0 OR (v_component->>'directionDeg')::numeric >= 360
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
    INSERT INTO public.swell_watch_provider_run_revisions (scope_id,semantic_revision_hash,semantic_payload,selected_grid) VALUES (v_scope_id,v_receipt->>'revisionHash',v_semantic,v_receipt->'selectedGrid') ON CONFLICT (scope_id,semantic_revision_hash) DO NOTHING RETURNING id INTO v_revision;
    IF v_revision IS NULL THEN SELECT id,selected_grid INTO v_revision,v_existing_grid FROM public.swell_watch_provider_run_revisions WHERE scope_id=v_scope_id AND semantic_revision_hash=v_receipt->>'revisionHash' AND semantic_payload=v_semantic; IF v_revision IS NULL OR v_existing_grid IS DISTINCT FROM v_receipt->'selectedGrid' THEN RAISE EXCEPTION 'provider receipt revision hash conflicts with its payload'; END IF;
    END IF;
    FOR v_observation IN SELECT value FROM jsonb_array_elements(v_receipt->'observations') LOOP
      FOR v_component IN SELECT value FROM jsonb_array_elements(v_observation->'components') LOOP
        INSERT INTO public.swell_watch_provider_run_revision_components (revision_id,provider_forecast_at,forecast_at,source_slot,height_m,period_s,direction_deg,raw_field_provenance,time_provenance)
        VALUES (v_revision,v_observation->>'providerForecastAt',(v_observation->>'forecastAtUtc')::timestamptz,v_component->>'sourceSlot',(v_component->>'heightM')::numeric,(v_component->>'periodS')::numeric,(v_component->>'directionDeg')::numeric,v_component->'rawFieldProvenance',v_observation->'timeProvenance')
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

CREATE OR REPLACE FUNCTION public.complete_swell_watch_provider_run_receipt(p_revision_set_id uuid)
RETURNS TABLE(provider_batch_id uuid, evaluation_id text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_batch uuid; v_run_text text; v_completed public.swell_watch_provider_run_completed_batches;
BEGIN
  SELECT revision_set.batch_id,to_char(issuance.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"') INTO v_batch,v_run_text
  FROM public.swell_watch_provider_run_revision_sets revision_set
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=revision_set.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE revision_set.id=p_revision_set_id;
  IF v_batch IS NULL THEN RAISE EXCEPTION 'provider revision set does not exist'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || v_run_text,0));
  IF NOT EXISTS (
    SELECT 1
    FROM public.swell_watch_provider_run_revision_sets requested
    WHERE requested.id = p_revision_set_id
      AND requested.revision_number = (
        SELECT max(candidate.revision_number)
        FROM public.swell_watch_provider_run_revision_sets candidate
        WHERE candidate.batch_id = v_batch
      )
  ) THEN RAISE EXCEPTION 'only the latest provider revision set can be completed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_attestations accepted WHERE accepted.revision_set_id=p_revision_set_id AND accepted.state='accepted' AND NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_attestations revoked WHERE revoked.state='revoked' AND revoked.revokes_attestation_id=accepted.id)) THEN RAISE EXCEPTION 'active accepted attestation is required'; END IF;
  SELECT * INTO v_completed FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id=p_revision_set_id;
  IF v_completed.id IS NOT NULL THEN RETURN QUERY SELECT v_completed.id,'genuine_completed:' || v_batch; RETURN; END IF;
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_provider_run_completed_batches (batch_id,revision_set_id) VALUES (v_batch,p_revision_set_id) RETURNING id INTO provider_batch_id;
  RETURN QUERY SELECT provider_batch_id,'genuine_completed:' || v_batch;
END;
$$;

-- Keep the historical RPC available to fixtures, but never let it mint genuine identities.
ALTER FUNCTION public.ingest_swell_watch_evaluation(uuid,uuid,uuid,text,uuid,text,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,text,timestamptz,timestamptz) RENAME TO ingest_swell_watch_evaluation_internal;
CREATE OR REPLACE FUNCTION public.ingest_swell_watch_evaluation(p_observation_id uuid,p_impact_id uuid,p_regional_event_id uuid,p_evaluation_id text,p_source_point_id uuid,p_region_key text,p_physical_key text,p_provider text,p_forecast_at timestamptz,p_source_slot text,p_height_m numeric,p_period_s numeric,p_direction_deg numeric,p_projected_face_height_ft numeric,p_policy_id text,p_policy_hash text,p_impact_hash text,p_identity_kind text,p_arrival_at timestamptz,p_peak_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$ BEGIN
  IF p_identity_kind <> 'synthetic_fixture' OR p_evaluation_id !~ '^synthetic_fixture:[^[:space:]]{1,180}$' THEN RAISE EXCEPTION 'generic swell watch ingestion is fixture-only'; END IF;
  PERFORM public.ingest_swell_watch_evaluation_internal(p_observation_id,p_impact_id,p_regional_event_id,p_evaluation_id,p_source_point_id,p_region_key,p_physical_key,p_provider,p_forecast_at,p_source_slot,p_height_m,p_period_s,p_direction_deg,p_projected_face_height_ft,p_policy_id,p_policy_hash,p_impact_hash,p_identity_kind,p_arrival_at,p_peak_at);
END; $$;
CREATE OR REPLACE FUNCTION public.ingest_verified_swell_watch_evaluation(p_provider_batch_id uuid,p_observation_id uuid,p_impact_id uuid,p_regional_event_id uuid,p_source_point_id uuid,p_region_key text,p_physical_key text,p_forecast_at timestamptz,p_source_slot text,p_height_m numeric,p_period_s numeric,p_direction_deg numeric,p_projected_face_height_ft numeric,p_policy_id text,p_policy_hash text,p_impact_hash text,p_arrival_at timestamptz,p_peak_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_evaluation text; v_run_text text;
BEGIN
  SELECT 'genuine_completed:' || batch.id,to_char(issuance.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"') INTO v_evaluation,v_run_text
  FROM public.swell_watch_provider_run_completed_batches completed
  JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
  JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
  WHERE completed.id=p_provider_batch_id;
  IF v_evaluation IS NULL THEN RAISE EXCEPTION 'provider batch is not completed'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-region:' || p_region_key,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || p_regional_event_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' || v_run_text,0));
  IF EXISTS (
    SELECT 1 FROM public.swell_watch_observations observation
    WHERE observation.evaluation_id=v_evaluation
      AND observation.source_point_id=p_source_point_id
      AND observation.provider='open_meteo'
      AND observation.forecast_at=p_forecast_at
      AND observation.source_slot=p_source_slot
      AND observation.provider_batch_id IS DISTINCT FROM p_provider_batch_id
  ) THEN RAISE EXCEPTION 'provider correction requires evaluation suppression'; END IF;
  PERFORM set_config('app.swell_watch_verified_batch_id',p_provider_batch_id::text,true);
  PERFORM public.ingest_swell_watch_evaluation_internal(p_observation_id,p_impact_id,p_regional_event_id,v_evaluation,p_source_point_id,p_region_key,p_physical_key,'open_meteo',p_forecast_at,p_source_slot,p_height_m,p_period_s,p_direction_deg,p_projected_face_height_ft,p_policy_id,p_policy_hash,p_impact_hash,'genuine_completed',p_arrival_at,p_peak_at);
END; $$;

CREATE OR REPLACE FUNCTION public.swell_watch_provider_evidence_is_current(p_provider_batch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.swell_watch_provider_run_completed_batches completed
    JOIN public.swell_watch_provider_run_revision_sets revision_set ON revision_set.id=completed.revision_set_id
    JOIN public.swell_watch_provider_run_attestations accepted ON accepted.revision_set_id=revision_set.id AND accepted.state='accepted'
    WHERE completed.id=p_provider_batch_id
      AND revision_set.revision_number=(SELECT max(candidate.revision_number) FROM public.swell_watch_provider_run_revision_sets candidate WHERE candidate.batch_id=completed.batch_id)
      AND NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_attestations revoked WHERE revoked.state='revoked' AND revoked.revokes_attestation_id=accepted.id)
  );
$$;

ALTER FUNCTION public.swell_watch_validate_notification_release(uuid,uuid,uuid,timestamptz,uuid) RENAME TO swell_watch_validate_notification_release_internal;
CREATE OR REPLACE FUNCTION public.swell_watch_validate_notification_release(p_regional_event_id uuid,p_beach_id uuid,p_recipient_id uuid,p_forecast_at timestamptz,p_notification_event_id uuid)
RETURNS TABLE(allowed boolean,reason_code text,control_epoch integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_identity_kind text;
  v_provider_batch_id uuid;
  v_supporting_evidence_count integer;
  v_current_supporting_evidence_count integer;
  v_supporting_issuance_count integer;
  v_policy_values jsonb;
  v_policy_hash text;
  v_required numeric;
  v_max_direction numeric;
  v_max_period numeric;
  v_max_hours numeric;
  v_continuous boolean;
BEGIN
  IF p_regional_event_id IS NULL OR p_beach_id IS NULL OR p_recipient_id IS NULL
    OR p_forecast_at IS NULL OR NOT isfinite(p_forecast_at) OR p_notification_event_id IS NULL THEN
    RETURN QUERY SELECT false,'invalid_release_input',NULL::integer;
    RETURN;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-event:' || p_regional_event_id::text,0));
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'swell-watch-provider-run:' || to_char(provider_runs.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0
  ))
  FROM (
    SELECT DISTINCT issuance.run_utc
    FROM public.swell_watch_event_impacts evaluation
    JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE evaluation.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
      AND observation.identity_kind='genuine_completed'
  ) provider_runs
  ORDER BY provider_runs.run_utc;
  SELECT observation.identity_kind,observation.provider_batch_id INTO v_identity_kind,v_provider_batch_id
  FROM public.swell_watch_event_state_transitions transition
  JOIN public.swell_watch_event_impacts evaluation ON evaluation.regional_event_id=transition.regional_event_id
  JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
  JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
  WHERE transition.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
  ORDER BY transition.version DESC,evaluation.evaluated_at DESC,evaluation.id DESC LIMIT 1;
  SELECT count(*),
    count(*) FILTER (WHERE identity_kind='genuine_completed'
      AND public.swell_watch_provider_evidence_is_current(provider_batch_id) IS TRUE),
    count(DISTINCT issuance_id)
  INTO v_supporting_evidence_count,v_current_supporting_evidence_count,v_supporting_issuance_count
  FROM (
    SELECT observation.identity_kind,observation.provider_batch_id,issuance.id AS issuance_id
    FROM public.swell_watch_event_impacts evaluation
    JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    LEFT JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    LEFT JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    LEFT JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE evaluation.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
      AND evaluation.evaluated_at>coalesce((SELECT max(transition.created_at) FROM public.swell_watch_event_state_transitions transition WHERE transition.regional_event_id=p_regional_event_id AND transition.state='suppressed'),'-infinity'::timestamptz)
    ORDER BY evaluation.evaluated_at DESC,evaluation.id DESC LIMIT 2
  ) supporting_evidence;
  IF v_identity_kind IS DISTINCT FROM 'genuine_completed'
    OR public.swell_watch_provider_evidence_is_current(v_provider_batch_id) IS DISTINCT FROM true
    OR v_supporting_evidence_count IS DISTINCT FROM 2
    OR v_current_supporting_evidence_count IS DISTINCT FROM 2
    OR v_supporting_issuance_count IS DISTINCT FROM 2 THEN
    RETURN QUERY SELECT false,'provider_evidence_unavailable',NULL::integer;
    RETURN;
  END IF;
  -- A stable row and two authentic runs do not prove they describe one swell.
  -- Use owner-approved thresholds, never caller-supplied matching tolerances.
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT authority.policy_values,authority.policy_hash INTO v_policy_values,v_policy_hash
  FROM public.swell_watch_production_approval_authority authority
  WHERE authority.state='active' AND authority.production_scope='swell_watch_push'
  ORDER BY authority.authority_epoch DESC LIMIT 1;
  IF jsonb_typeof(v_policy_values #> '{partition_matching,maximum_direction_delta_deg}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_policy_values #> '{partition_matching,maximum_period_delta_s}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_policy_values #> '{partition_matching,maximum_arrival_delta_hours}') IS DISTINCT FROM 'number'
    OR jsonb_typeof(v_policy_values #> '{stability,minimum_genuine_evaluations}') IS DISTINCT FROM 'number' THEN
    RETURN QUERY SELECT false,'authority_unavailable',NULL::integer;
    RETURN;
  END IF;
  v_max_direction := (v_policy_values #>> '{partition_matching,maximum_direction_delta_deg}')::numeric;
  v_max_period := (v_policy_values #>> '{partition_matching,maximum_period_delta_s}')::numeric;
  v_max_hours := (v_policy_values #>> '{partition_matching,maximum_arrival_delta_hours}')::numeric;
  v_required := (v_policy_values #>> '{stability,minimum_genuine_evaluations}')::numeric;
  IF v_max_direction<=0 OR v_max_period<=0 OR v_max_hours<=0
    OR v_required<2 OR v_required>2147483647 OR trunc(v_required)<>v_required THEN
    RETURN QUERY SELECT false,'authority_unavailable',NULL::integer;
    RETURN;
  END IF;
  WITH supporting AS (
    SELECT evaluation.id,evaluation.evaluated_at,evaluation.arrival_at,evaluation.peak_at,
      observation.provider,observation.period_s,observation.direction_deg,
      observation.provider_batch_id,impact.policy_hash,issuance.id AS issuance_id,issuance.run_utc
    FROM public.swell_watch_event_impacts evaluation
    JOIN public.swell_watch_beach_impacts impact ON impact.id=evaluation.beach_impact_id
    JOIN public.swell_watch_observations observation ON observation.id=impact.observation_id
    LEFT JOIN public.swell_watch_provider_run_completed_batches completed ON completed.id=observation.provider_batch_id
    LEFT JOIN public.swell_watch_provider_run_batches batch ON batch.id=completed.batch_id
    LEFT JOIN public.swell_watch_provider_run_issuances issuance ON issuance.id=batch.issuance_id
    WHERE evaluation.regional_event_id=p_regional_event_id AND impact.beach_id=p_beach_id
      AND evaluation.evaluated_at>coalesce((SELECT max(transition.created_at) FROM public.swell_watch_event_state_transitions transition WHERE transition.regional_event_id=p_regional_event_id AND transition.state='suppressed'),'-infinity'::timestamptz)
    ORDER BY evaluation.evaluated_at DESC,evaluation.id DESC LIMIT v_required::integer
  ), pairs AS (
    SELECT *,lead(provider) OVER sequence AS prior_provider,
      lead(period_s) OVER sequence AS prior_period,lead(direction_deg) OVER sequence AS prior_direction,
      lead(arrival_at) OVER sequence AS prior_arrival,lead(peak_at) OVER sequence AS prior_peak,
      lead(run_utc) OVER sequence AS prior_run
    FROM supporting WINDOW sequence AS (ORDER BY evaluated_at DESC,id DESC)
  )
  SELECT count(*)=v_required AND count(DISTINCT issuance_id)=v_required
    AND bool_and(public.swell_watch_provider_evidence_is_current(provider_batch_id) IS TRUE
      AND policy_hash=v_policy_hash AND isfinite(arrival_at) AND isfinite(peak_at)
      AND (prior_provider IS NULL OR (
        provider=prior_provider AND run_utc>prior_run
        AND abs(period_s-prior_period)<=v_max_period
        AND least(abs(direction_deg-prior_direction),360-abs(direction_deg-prior_direction))<=v_max_direction
        AND abs(extract(epoch FROM arrival_at-prior_arrival))<=v_max_hours*3600
        AND abs(extract(epoch FROM peak_at-prior_peak))<=v_max_hours*3600)))
  INTO v_continuous FROM pairs;
  IF v_continuous IS DISTINCT FROM true THEN
    RETURN QUERY SELECT false,'event_not_releasable',NULL::integer;
    RETURN;
  END IF;
  RETURN QUERY SELECT * FROM public.swell_watch_validate_notification_release_internal(p_regional_event_id,p_beach_id,p_recipient_id,p_forecast_at,p_notification_event_id);
END; $$;

ALTER TABLE public.swell_watch_provider_run_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_batch_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_revision_raw_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_revision_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_revision_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_revision_set_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_attestations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_provider_run_completed_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_provider_run_issuances,public.swell_watch_provider_run_batches,public.swell_watch_provider_run_batch_scopes,public.swell_watch_provider_run_revisions,public.swell_watch_provider_run_revision_raw_responses,public.swell_watch_provider_run_revision_components,public.swell_watch_provider_run_revision_sets,public.swell_watch_provider_run_revision_set_members,public.swell_watch_provider_run_attestations,public.swell_watch_provider_run_completed_batches FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.ingest_swell_watch_evaluation_internal(uuid,uuid,uuid,text,uuid,text,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.ingest_swell_watch_evaluation(uuid,uuid,uuid,text,uuid,text,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.swell_watch_validate_notification_release_internal(uuid,uuid,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.swell_watch_validate_notification_release(uuid,uuid,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.swell_watch_provider_evidence_is_current(uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE EXECUTE ON FUNCTION public.record_swell_watch_provider_run_receipt(jsonb),public.complete_swell_watch_provider_run_receipt(uuid),public.ingest_verified_swell_watch_evaluation(uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.record_swell_watch_provider_run_receipt(jsonb),public.complete_swell_watch_provider_run_receipt(uuid),public.ingest_verified_swell_watch_evaluation(uuid,uuid,uuid,uuid,uuid,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,timestamptz,timestamptz),public.ingest_swell_watch_evaluation(uuid,uuid,uuid,text,uuid,text,text,text,timestamptz,text,numeric,numeric,numeric,numeric,text,text,text,text,timestamptz,timestamptz),public.swell_watch_validate_notification_release(uuid,uuid,uuid,timestamptz,uuid) TO service_role;
COMMIT;
