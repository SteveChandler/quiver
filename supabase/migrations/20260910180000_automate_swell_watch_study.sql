-- Standing owner authorization for a no-send study. Deliberately seeds no authority.
-- Rollback: append a revoked authority epoch; preserve evidence/accounting history.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

CREATE FUNCTION public.swell_watch_study_scope_inputs(p_cohort jsonb)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('sourcePointId',b.id,'latitude',b.lat,'longitude',b.lon,
    'beach',jsonb_build_object('swell_window_center_deg',b.swell_window_center_deg,
      'swell_window_halfwidth_deg',b.swell_window_halfwidth_deg,'swell_access_factors',b.swell_access_factors,
      'terrain_enabled',b.terrain_enabled,'deepwater_decay_factor',b.deepwater_decay_factor,
      'shoaling_factors',b.shoaling_factors)) ORDER BY b.id),'[]'::jsonb)
  FROM public.beaches b WHERE b.id IN (SELECT (c->>'sourcePointId')::uuid FROM jsonb_array_elements(p_cohort) c)
    AND b.deleted_at IS NULL AND b.is_private=false AND b.owner_id IS NULL;
$$;

CREATE TABLE public.swell_watch_study_authorities (
  epoch bigint PRIMARY KEY CHECK (epoch > 0),
  state text NOT NULL CHECK (state IN ('active','revoked')),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  cohort jsonb NOT NULL CHECK (jsonb_typeof(cohort)='array' AND jsonb_array_length(cohort)=10),
  scope_inputs jsonb NOT NULL CHECK (jsonb_typeof(scope_inputs)='array' AND jsonb_array_length(scope_inputs)=10),
  config_hash text NOT NULL CHECK (config_hash ~ '^[a-f0-9]{64}$'),
  target_days integer NOT NULL DEFAULT 30 CHECK (target_days BETWEEN 1 AND 365),
  provider_contract_ref text NOT NULL CHECK (char_length(btrim(provider_contract_ref)) BETWEEN 1 AND 500),
  evidence_sha256 text NOT NULL CHECK (evidence_sha256 ~ '^[a-f0-9]{64}$'),
  reviewer text NOT NULL CHECK (char_length(btrim(reviewer)) BETWEEN 1 AND 200),
  not_before timestamptz NOT NULL CHECK (isfinite(not_before)),
  expires_at timestamptz NOT NULL CHECK (isfinite(expires_at) AND expires_at>not_before),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

CREATE FUNCTION public.guard_swell_watch_study_authority()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE canonical jsonb;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'study authority is append only'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  IF NEW.epoch<>coalesce((SELECT max(epoch) FROM public.swell_watch_study_authorities),0)+1 THEN
    RAISE EXCEPTION 'study authority epoch must advance by one';
  END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.cohort) s WHERE
    jsonb_typeof(s) IS DISTINCT FROM 'object' OR s-'sourcePointId'-'regionKey'<>'{}'::jsonb
    OR coalesce(s->>'sourcePointId','') !~ '^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$'
    OR jsonb_typeof(s->'regionKey') IS DISTINCT FROM 'string'
    OR char_length(btrim(s->>'regionKey')) NOT BETWEEN 1 AND 100
    OR s->>'regionKey' IS DISTINCT FROM btrim(s->>'regionKey'))
    OR (SELECT count(DISTINCT s->>'sourcePointId') FROM jsonb_array_elements(NEW.cohort) s)<>10 THEN
    RAISE EXCEPTION 'invalid study cohort';
  END IF;
  SELECT jsonb_agg(s ORDER BY s->>'sourcePointId') INTO canonical FROM jsonb_array_elements(NEW.cohort) s;
  IF NEW.state='active' THEN
    PERFORM 1 FROM public.beaches b WHERE b.id IN (SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(NEW.cohort) s)
      ORDER BY b.id FOR SHARE;
    IF NEW.scope_inputs IS DISTINCT FROM public.swell_watch_study_scope_inputs(NEW.cohort) THEN
      RAISE EXCEPTION 'study scope inputs differ from current beaches';
    END IF;
  END IF;
  IF canonical IS DISTINCT FROM NEW.cohort OR NEW.config_hash IS DISTINCT FROM
    encode(extensions.digest(jsonb_build_object('policyHash',NEW.policy_hash,'cohort',NEW.cohort,'scopeInputs',NEW.scope_inputs,
      'forecastDays',7,'targetDays',NEW.target_days,'providerContractRef',NEW.provider_contract_ref,'evidenceSha256',NEW.evidence_sha256)::text,'sha256'),'hex') THEN
    RAISE EXCEPTION 'study config hash or cohort ordering mismatch';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER swell_watch_study_authority_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.swell_watch_study_authorities FOR EACH ROW EXECUTE FUNCTION public.guard_swell_watch_study_authority();

CREATE TABLE public.swell_watch_study_acceptances (
  revision_set_id uuid PRIMARY KEY REFERENCES public.swell_watch_provider_run_revision_sets(id),
  authority_epoch bigint NOT NULL REFERENCES public.swell_watch_study_authorities(epoch),
  attestation_id uuid NOT NULL UNIQUE REFERENCES public.swell_watch_provider_run_attestations(id),
  evidence_manifest jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.swell_watch_study_evaluations (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider_batch_id uuid NOT NULL REFERENCES public.swell_watch_provider_run_completed_batches(id),
  authority_epoch bigint NOT NULL REFERENCES public.swell_watch_study_authorities(epoch),
  policy_hash text NOT NULL CHECK (policy_hash ~ '^[a-f0-9]{64}$'),
  result jsonb NOT NULL,
  result_hash text NOT NULL,
  status text NOT NULL CHECK (status IN ('evaluated','suppressed')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(provider_batch_id,policy_hash,result_hash)
);
CREATE UNIQUE INDEX swell_watch_study_success_once ON public.swell_watch_study_evaluations(provider_batch_id,policy_hash)
  WHERE status='evaluated';
CREATE TRIGGER swell_watch_study_acceptances_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.swell_watch_study_acceptances FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();
CREATE TRIGGER swell_watch_study_evaluations_guard BEFORE INSERT OR UPDATE OR DELETE
  ON public.swell_watch_study_evaluations FOR EACH ROW EXECUTE FUNCTION public.swell_watch_provider_run_append_only_trigger();

CREATE FUNCTION public.swell_watch_current_study_authority(p_policy_hash text)
RETURNS SETOF public.swell_watch_study_authorities
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT a.* FROM public.swell_watch_study_authorities a
  WHERE a.epoch=(SELECT max(epoch) FROM public.swell_watch_study_authorities)
    AND a.state='active' AND a.policy_hash=p_policy_hash
    AND clock_timestamp()>=a.not_before AND clock_timestamp()<a.expires_at
    AND a.scope_inputs=public.swell_watch_study_scope_inputs(a.cohort)
    AND EXISTS(SELECT 1 FROM public.swell_watch_get_automation_control() c WHERE c.state='disabled')
    AND NOT EXISTS(SELECT 1 FROM public.swell_watch_get_production_authority())
    AND EXISTS(SELECT 1 FROM public.swell_watch_evaluation_policies p
      WHERE p.epoch=(SELECT max(epoch) FROM public.swell_watch_evaluation_policies)
        AND p.state='active' AND p.policy_hash=a.policy_hash
        AND clock_timestamp()>=p.not_before AND clock_timestamp()<p.expires_at
        AND p.policy_values #> '{cadence,evaluation_interval_minutes}'='60'::jsonb);
$$;

-- Existing consumers retain their checks; machine evidence additionally requires live study authority.
ALTER FUNCTION public.swell_watch_provider_evidence_is_current(uuid) RENAME TO swell_watch_provider_evidence_is_current_before_study;
CREATE FUNCTION public.swell_watch_provider_evidence_is_current(p_provider_batch_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.swell_watch_provider_evidence_is_current_before_study(p_provider_batch_id)
    AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id
      JOIN public.swell_watch_study_authorities a ON a.epoch=s.authority_epoch
      WHERE b.id=p_provider_batch_id AND (
        NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(a.policy_hash) c WHERE c.epoch=a.epoch)
        OR EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations t
          WHERE t.revision_set_id=s.revision_set_id AND t.state IN ('rejected','revoked'))));
$$;

CREATE FUNCTION public.complete_swell_watch_study_run(p_revision_set_id uuid,p_policy_hash text,p_cohort jsonb,p_scope_inputs jsonb)
RETURNS TABLE(provider_batch_id uuid,evaluation_id text,already_evaluated boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.swell_watch_study_authorities; r record; manifest jsonb; attestation uuid; completed record; max_age interval;
BEGIN
  -- Same order as existing completion/release: frontier -> run -> control.
  IF NOT pg_try_advisory_xact_lock(hashtextextended('swell-watch-completed-provider-frontier',0)) THEN
    RAISE EXCEPTION 'provider completion is busy; retry transaction';
  END IF;
  SELECT s.*,b.expected_component_count,i.run_utc,i.transport_provider,i.model,i.parser_version INTO r
    FROM public.swell_watch_provider_run_revision_sets s
    JOIN public.swell_watch_provider_run_batches b ON b.id=s.batch_id
    JOIN public.swell_watch_provider_run_issuances i ON i.id=b.issuance_id WHERE s.id=p_revision_set_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'study revision does not exist'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' ||
    to_char(r.run_utc AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  PERFORM 1 FROM public.beaches b WHERE b.id IN (SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(p_cohort) s)
    ORDER BY b.id FOR SHARE;
  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);
  IF NOT FOUND OR a.cohort IS DISTINCT FROM p_cohort OR a.scope_inputs IS DISTINCT FROM p_scope_inputs THEN
    RAISE EXCEPTION 'current study config required'; END IF;
  IF r.revision_number<>(SELECT max(revision_number) FROM public.swell_watch_provider_run_revision_sets WHERE batch_id=r.batch_id)
    OR r.expected_component_count<>3360 OR r.transport_provider<>'open_meteo_single_runs'
    OR r.model<>'ncep_gfswave016' OR r.parser_version<>'open-meteo-single-runs-receipt.v1'
    OR NOT isfinite(r.run_utc) OR r.run_utc>clock_timestamp()
    OR extract(epoch FROM r.run_utc)::bigint % 21600<>0 THEN RAISE EXCEPTION 'invalid current study revision'; END IF;
  IF EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations t
    WHERE t.revision_set_id=p_revision_set_id AND t.state IN ('rejected','revoked')) THEN
    RAISE EXCEPTION 'study revision is held by rejection or revocation';
  END IF;
  SELECT b.id AS provider_batch_id,'genuine_completed:'||b.batch_id AS evaluation_id INTO completed
    FROM public.swell_watch_provider_run_completed_batches b
    JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id
    WHERE b.revision_set_id=p_revision_set_id AND s.authority_epoch=a.epoch
      AND EXISTS(SELECT 1 FROM public.swell_watch_study_evaluations e WHERE e.provider_batch_id=b.id
        AND e.policy_hash=p_policy_hash AND e.status='evaluated');
  IF FOUND AND public.swell_watch_provider_evidence_is_current(completed.provider_batch_id) THEN
    -- Exact successful retries acknowledge immutable work, even after freshness/target cutoff.
    RETURN QUERY SELECT completed.provider_batch_id,completed.evaluation_id,true;
    RETURN;
  END IF;
  SELECT make_interval(secs=>(p.policy_values #>> '{staleness,maximum_forecast_age_hours}')::double precision*3600)
    INTO max_age FROM public.swell_watch_evaluation_policies p ORDER BY p.epoch DESC LIMIT 1;
  IF clock_timestamp()>r.run_utc+max_age THEN RAISE EXCEPTION 'study run is stale'; END IF;
  IF public.read_swell_watch_study_health()->>'status' IS DISTINCT FROM 'active' THEN
    RAISE EXCEPTION 'study is not active';
  END IF;
  IF (SELECT count(*) FROM public.swell_watch_provider_run_revision_set_members WHERE revision_set_id=p_revision_set_id)<>10
    OR (SELECT count(*) FROM public.swell_watch_provider_run_batch_scopes WHERE batch_id=r.batch_id)<>10
    OR EXISTS(SELECT 1 FROM public.swell_watch_provider_run_revision_set_members m
      JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id
      JOIN public.swell_watch_provider_run_revisions v ON v.id=m.revision_id
      WHERE m.revision_set_id=p_revision_set_id AND (s.batch_id<>r.batch_id OR v.scope_id<>s.id OR s.forecast_days<>7
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.cohort) c WHERE c->>'sourcePointId'=s.source_point_id::text)
        OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.scope_inputs) c WHERE c->>'sourcePointId'=s.source_point_id::text
          AND (c->>'latitude')::numeric=s.requested_lat AND (c->>'longitude')::numeric=s.requested_lon)
        OR (SELECT count(*) FROM public.swell_watch_provider_run_revision_components c WHERE c.revision_id=v.id)<>336
        OR NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_revision_raw_responses raw WHERE raw.revision_id=v.id)
        OR EXISTS(SELECT 1 FROM public.swell_watch_provider_run_revision_raw_responses raw WHERE raw.revision_id=v.id
          AND (encode(extensions.digest(raw.raw_response,'sha256'),'hex') IS DISTINCT FROM raw.raw_response_sha256
            OR raw.raw_response::jsonb-'generationtime_ms' IS DISTINCT FROM v.semantic_payload)))) THEN
    RAISE EXCEPTION 'study receipt coverage or raw evidence invalid';
  END IF;
  SELECT s.attestation_id INTO attestation FROM public.swell_watch_study_acceptances s WHERE s.revision_set_id=p_revision_set_id;
  IF FOUND THEN
    IF NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances s WHERE s.revision_set_id=p_revision_set_id AND s.authority_epoch=a.epoch) THEN
      RAISE EXCEPTION 'study acceptance belongs to a different authority epoch';
    END IF;
  ELSE
    SELECT jsonb_build_object('authorityEpoch',a.epoch,'configHash',a.config_hash,'revisionSetHash',r.revision_set_hash,
      'rawEvidence',jsonb_agg(jsonb_build_object('revisionId',m.revision_id,'sha256',raw.raw_response_sha256)
        ORDER BY m.revision_id,raw.raw_response_sha256)) INTO manifest
      FROM public.swell_watch_provider_run_revision_set_members m
      JOIN public.swell_watch_provider_run_revision_raw_responses raw ON raw.revision_id=m.revision_id
      WHERE m.revision_set_id=p_revision_set_id;
    attestation := gen_random_uuid();
    PERFORM public.attest_swell_watch_provider_run(attestation,p_revision_set_id,'accepted',a.reviewer,
      encode(extensions.digest(manifest::text,'sha256'),'hex'),a.provider_contract_ref);
    INSERT INTO public.swell_watch_study_acceptances(revision_set_id,authority_epoch,attestation_id,evidence_manifest)
      VALUES(p_revision_set_id,a.epoch,attestation,manifest);
  END IF;
  SELECT * INTO completed FROM public.complete_swell_watch_provider_run_receipt(p_revision_set_id);
  RETURN QUERY SELECT completed.provider_batch_id,completed.evaluation_id,EXISTS(
    SELECT 1 FROM public.swell_watch_study_evaluations e WHERE e.provider_batch_id=completed.provider_batch_id
      AND e.policy_hash=p_policy_hash AND e.status='evaluated');
END;
$$;

-- The legacy observation trigger duplicates attestation checks instead of calling currentness.
-- Its verified-batch trigger sorts before this trigger and populates provider_batch_id first.
CREATE FUNCTION public.guard_swell_watch_study_observation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NEW.provider_batch_id IS NOT NULL AND EXISTS(
    SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
    JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id WHERE b.id=NEW.provider_batch_id) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
    IF public.swell_watch_provider_evidence_is_current(NEW.provider_batch_id) IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'current study evidence required';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER swell_watch_observations_z_study_guard BEFORE INSERT ON public.swell_watch_observations
  FOR EACH ROW EXECUTE FUNCTION public.guard_swell_watch_study_observation();

CREATE FUNCTION public.record_swell_watch_study_evaluation(p_provider_batch_id uuid,p_policy_hash text,p_result jsonb,p_scope_inputs jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.swell_watch_study_authorities; run_at timestamptz; measured_at timestamptz; digest text; demand public.swell_watch_shadow_demand_runs; raw_batch uuid;
BEGIN
  SELECT i.run_utc,b.batch_id INTO run_at,raw_batch FROM public.swell_watch_provider_run_completed_batches b
    JOIN public.swell_watch_provider_run_batches rb ON rb.id=b.batch_id
    JOIN public.swell_watch_provider_run_issuances i ON i.id=rb.issuance_id WHERE b.id=p_provider_batch_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'completed study run required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:' ||
    to_char(run_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  PERFORM 1 FROM public.beaches b WHERE b.id IN (SELECT (s->>'sourcePointId')::uuid FROM jsonb_array_elements(p_scope_inputs) s)
    ORDER BY b.id FOR SHARE;
  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);
  IF NOT FOUND OR public.swell_watch_provider_evidence_is_current(p_provider_batch_id) IS DISTINCT FROM true
    OR a.scope_inputs IS DISTINCT FROM p_scope_inputs
    OR NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
      JOIN public.swell_watch_study_acceptances s ON s.revision_set_id=b.revision_set_id
      WHERE b.id=p_provider_batch_id AND s.authority_epoch=a.epoch) THEN
    RAISE EXCEPTION 'current study authority and evidence required';
  END IF;
  IF jsonb_typeof(p_result) IS DISTINCT FROM 'object' OR octet_length(p_result::text)>131072
    OR p_result->>'providerBatchId' IS DISTINCT FROM p_provider_batch_id::text
    OR p_result->>'policyHash' IS DISTINCT FROM p_policy_hash
    OR coalesce(p_result->>'status','') NOT IN ('evaluated','suppressed')
    OR p_result->'enqueued' IS DISTINCT FROM '0'::jsonb
    OR p_result->>'sendEligibility' IS DISTINCT FROM 'not_evaluated'
    OR jsonb_typeof(p_result->'scopeOutcomes') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'invalid study result'; END IF;
  IF jsonb_array_length(p_result->'scopeOutcomes')<>10
    OR (SELECT count(DISTINCT s->>'sourcePointId') FROM jsonb_array_elements(p_result->'scopeOutcomes') s)<>10
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->'scopeOutcomes') s WHERE
      jsonb_typeof(s) IS DISTINCT FROM 'object' OR s-'sourcePointId'-'status'-'reason'<>'{}'::jsonb
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.cohort) c WHERE c->>'sourcePointId'=s->>'sourcePointId')
      OR coalesce(s->>'status','') NOT IN ('derived','suppressed')
      OR (s->>'status'='derived' AND s->'reason' IS DISTINCT FROM 'null'::jsonb)
      OR (s->>'status'='suppressed' AND (jsonb_typeof(s->'reason') IS DISTINCT FROM 'string'
        OR char_length(btrim(s->>'reason')) NOT BETWEEN 1 AND 500))) THEN RAISE EXCEPTION 'invalid study scope outcomes'; END IF;
  digest := encode(extensions.digest(p_result::text,'sha256'),'hex');
  IF EXISTS(SELECT 1 FROM public.swell_watch_study_evaluations e WHERE e.provider_batch_id=p_provider_batch_id
    AND e.policy_hash=p_policy_hash AND e.result_hash=digest) THEN RETURN '{"recorded":true}'::jsonb; END IF;
  IF EXISTS(SELECT 1 FROM public.swell_watch_study_evaluations e WHERE e.provider_batch_id=p_provider_batch_id
    AND e.policy_hash=p_policy_hash AND e.status='evaluated') THEN RAISE EXCEPTION 'successful study result is immutable'; END IF;
  measured_at := clock_timestamp();
  IF p_result->>'status'='evaluated' THEN
    IF p_result->'evaluationIds' IS DISTINCT FROM jsonb_build_array('genuine_completed:'||raw_batch)
      OR EXISTS(SELECT 1 FROM unnest(ARRAY['candidateCount','stableRegionalEventCount','preSafetyRecipientsThisEvaluation']) field
        WHERE CASE WHEN jsonb_typeof(p_result->field)='number' THEN
          (p_result->>field)::numeric<0 OR (p_result->>field)::numeric>9007199254740991
          OR trunc((p_result->>field)::numeric)<>(p_result->>field)::numeric ELSE true END)
      OR jsonb_typeof(p_result->'suppressionReasons') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_result->'safety') IS DISTINCT FROM 'object'
      OR p_result->'projectedSendsRolling24Hours' IS DISTINCT FROM 'null'::jsonb
      OR p_result->'deliveryHealth' IS DISTINCT FROM 'null'::jsonb THEN
      RAISE EXCEPTION 'complete successful study result required';
    END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p_result->'suppressionReasons') reason
      WHERE char_length(btrim(reason.key)) NOT BETWEEN 1 AND 200 OR CASE WHEN jsonb_typeof(reason.value)='number' THEN
        (reason.value::text)::numeric<0 OR (reason.value::text)::numeric>9007199254740991
        OR trunc((reason.value::text)::numeric)<>(reason.value::text)::numeric ELSE true END)
      OR (p_result->'safety')-'reasonCode'-'missingMetrics'<>'{}'::jsonb
      OR p_result #> '{safety,missingMetrics}' IS DISTINCT FROM '["projected_send_window","delivery_health"]'::jsonb
      OR NOT ((p_result #> '{safety,reasonCode}')='null'::jsonb OR
        (p_result #>> '{safety,reasonCode}')=ANY(ARRAY['invalid_hold_input','authority_invalid','candidate_cap_exceeded',
          'recipient_cap_exceeded','projected_send_cap_exceeded','data_discontinuity','material_disagreement','forecast_stale','provider_failure_rate']))
      OR NOT (p_result->'safety' ? 'reasonCode') THEN RAISE EXCEPTION 'invalid study safety or suppression counters'; END IF;
    SELECT * INTO demand FROM public.swell_watch_shadow_demand_runs d WHERE d.provider_batch_id=p_provider_batch_id AND d.policy_hash=p_policy_hash;
    IF NOT FOUND OR p_result->'reason' IS DISTINCT FROM 'null'::jsonb
      OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->'scopeOutcomes') s WHERE s->>'status'<>'derived')
      OR jsonb_typeof(p_result #> '{recordedDemand,observedAt}') IS DISTINCT FROM 'string'
      OR jsonb_typeof(p_result #> '{recordedDemand,recipientEventPairs24Hours}') IS DISTINCT FROM 'number'
      OR p_result #>> '{recordedDemand,observedAt}' IS NULL
      OR (p_result #>> '{recordedDemand,observedAt}')::timestamptz IS DISTINCT FROM demand.observed_at
      OR (p_result #>> '{recordedDemand,recipientEventPairs24Hours}')::bigint IS DISTINCT FROM demand.recorded_pairs_24h
      OR measured_at<run_at OR measured_at>run_at+make_interval(secs=>(SELECT
        (p.policy_values #>> '{staleness,maximum_forecast_age_hours}')::double precision*3600
        FROM public.swell_watch_evaluation_policies p ORDER BY p.epoch DESC LIMIT 1)) THEN
      RAISE EXCEPTION 'fresh evaluated study demand and complete outcomes required';
    END IF;
  ELSIF jsonb_typeof(p_result->'reason') IS DISTINCT FROM 'string' OR char_length(btrim(p_result->>'reason')) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'suppression reason required';
  END IF;
  PERFORM set_config('app.swell_watch_internal_write','on',true);
  INSERT INTO public.swell_watch_study_evaluations(provider_batch_id,authority_epoch,policy_hash,result,result_hash,status,recorded_at)
    VALUES(p_provider_batch_id,a.epoch,p_policy_hash,p_result,digest,p_result->>'status',measured_at);
  RETURN '{"recorded":true}'::jsonb;
END;
$$;

CREATE FUNCTION public.read_swell_watch_study_health()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.swell_watch_study_authorities; days jsonb; policy_expiry timestamptz; health_status text; reason text; outcomes jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO a FROM public.swell_watch_study_authorities ORDER BY epoch DESC LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('status','unconfigured','qualifyingDays',0,'targetDays',30,
    'qualifyingDates','[]'::jsonb,'authorityEpoch',NULL,'policyHash',NULL,'reason','study_authority_missing',
    'evaluatedRuns',0,'suppressedAttempts',0,'lastEvaluatedAt',NULL,'lastSuppressedAt',NULL); END IF;
  SELECT expires_at INTO policy_expiry FROM public.swell_watch_evaluation_policies ORDER BY epoch DESC LIMIT 1;
  SELECT coalesce(jsonb_agg(day ORDER BY day),'[]'::jsonb) INTO days FROM (
    SELECT (i.run_utc AT TIME ZONE 'UTC')::date AS day
    FROM public.swell_watch_study_evaluations e
    JOIN public.swell_watch_provider_run_completed_batches b ON b.id=e.provider_batch_id
    JOIN public.swell_watch_provider_run_batches rb ON rb.id=b.batch_id
    JOIN public.swell_watch_provider_run_issuances i ON i.id=rb.issuance_id
    WHERE e.status='evaluated' AND e.policy_hash=a.policy_hash AND e.authority_epoch=a.epoch
      AND i.run_utc>=a.not_before
      AND public.swell_watch_provider_evidence_is_current_before_study(e.provider_batch_id)
      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations t WHERE t.revision_set_id=b.revision_set_id
        AND t.state IN ('rejected','revoked'))
    GROUP BY (i.run_utc AT TIME ZONE 'UTC')::date HAVING count(DISTINCT i.run_utc)=4
  ) qualified;
  SELECT jsonb_build_object('evaluatedRuns',count(*) FILTER(WHERE e.status='evaluated'),
    'suppressedAttempts',count(*) FILTER(WHERE e.status='suppressed'),
    'lastEvaluatedAt',max(e.recorded_at) FILTER(WHERE e.status='evaluated'),
    'lastSuppressedAt',max(e.recorded_at) FILTER(WHERE e.status='suppressed')) INTO outcomes
    FROM public.swell_watch_study_evaluations e WHERE e.authority_epoch=a.epoch AND e.policy_hash=a.policy_hash;
  IF a.state='revoked' THEN health_status:='blocked'; reason:='study_authority_revoked';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_evaluation_policies p
    WHERE p.epoch=(SELECT max(epoch) FROM public.swell_watch_evaluation_policies)
      AND p.state='active' AND p.policy_hash=a.policy_hash) THEN health_status:='blocked'; reason:='study_policy_changed';
  ELSIF jsonb_array_length(days)>=a.target_days THEN health_status:='complete'; reason:='target_reached';
  ELSIF clock_timestamp()>=a.expires_at OR clock_timestamp()>=policy_expiry THEN health_status:='expired'; reason:='study_or_policy_expired';
  ELSIF NOT EXISTS(SELECT 1 FROM public.swell_watch_current_study_authority(a.policy_hash)) THEN
    health_status:='blocked'; reason:='study_policy_or_control_unavailable';
  ELSE health_status:='active'; reason:=NULL; END IF;
  RETURN jsonb_build_object('status',health_status,'authorityEpoch',a.epoch,'policyHash',a.policy_hash,
    'qualifyingDays',jsonb_array_length(days),'qualifyingDates',days,'targetDays',a.target_days,'reason',reason,
    'expiresAt',least(a.expires_at,policy_expiry)) || outcomes;
END;
$$;

CREATE FUNCTION public.read_swell_watch_study_pending_runs(p_policy_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE a public.swell_watch_study_authorities; pending jsonb; max_age interval;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control',0));
  SELECT * INTO a FROM public.swell_watch_current_study_authority(p_policy_hash);
  IF NOT FOUND THEN RAISE EXCEPTION 'current study config required'; END IF;
  IF public.read_swell_watch_study_health()->>'status'<>'active' THEN RETURN '[]'::jsonb; END IF;
  SELECT make_interval(secs=>(p.policy_values #>> '{staleness,maximum_forecast_age_hours}')::double precision*3600)
    INTO max_age FROM public.swell_watch_evaluation_policies p ORDER BY p.epoch DESC LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object('revision_set_id',r.id) ORDER BY r.run_utc),'[]'::jsonb) INTO pending FROM (
    SELECT rs.id,i.run_utc FROM public.swell_watch_provider_run_revision_sets rs
    JOIN public.swell_watch_provider_run_batches b ON b.id=rs.batch_id
    JOIN public.swell_watch_provider_run_issuances i ON i.id=b.issuance_id
    WHERE rs.revision_number=(SELECT max(s.revision_number) FROM public.swell_watch_provider_run_revision_sets s WHERE s.batch_id=b.id)
      AND i.run_utc<=clock_timestamp() AND i.run_utc>=clock_timestamp()-max_age
      AND b.expected_component_count=3360
      AND (SELECT count(*) FROM public.swell_watch_provider_run_batch_scopes s WHERE s.batch_id=b.id)=10
      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_batch_scopes s WHERE s.batch_id=b.id
        AND (s.forecast_days<>7 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.scope_inputs) input
          WHERE input->>'sourcePointId'=s.source_point_id::text
            AND (input->>'latitude')::numeric=s.requested_lat AND (input->>'longitude')::numeric=s.requested_lon)))
      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_attestations t
        WHERE t.revision_set_id=rs.id AND t.state IN ('rejected','revoked'))
      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_study_acceptances s WHERE s.revision_set_id=rs.id AND s.authority_epoch<>a.epoch)
      AND NOT EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches c
        JOIN public.swell_watch_study_evaluations e ON e.provider_batch_id=c.id
        WHERE c.revision_set_id=rs.id AND e.policy_hash=p_policy_hash AND e.status='evaluated')
    ORDER BY i.run_utc LIMIT 3
  ) r;
  RETURN pending;
END;
$$;

ALTER TABLE public.swell_watch_study_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_study_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swell_watch_study_evaluations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.swell_watch_study_authorities,public.swell_watch_study_acceptances,public.swell_watch_study_evaluations FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.guard_swell_watch_study_authority(),public.swell_watch_current_study_authority(text),
  public.swell_watch_study_scope_inputs(jsonb),
  public.read_swell_watch_study_pending_runs(text),
  public.guard_swell_watch_study_observation(),
  public.swell_watch_provider_evidence_is_current(uuid),public.swell_watch_provider_evidence_is_current_before_study(uuid),
  public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb),public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb),
  public.read_swell_watch_study_health() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.complete_swell_watch_study_run(uuid,text,jsonb,jsonb),
  public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb),public.read_swell_watch_study_health(),
  public.read_swell_watch_study_pending_runs(text) TO service_role;
COMMIT;
