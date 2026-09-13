CREATE OR REPLACE FUNCTION public.fixture_provider_run_scopes(
  p_run text,
  p_height numeric,
  p_generationtime numeric DEFAULT 1,
  p_source_points uuid[] DEFAULT ARRAY[
    '11111111-1111-4111-8111-111111111111'::uuid,
    '22222222-2222-4222-8222-222222222222'::uuid
  ],
  p_primary_period numeric DEFAULT 12,
  p_secondary_height numeric DEFAULT 0.6,
  p_secondary_period numeric DEFAULT 9,
  p_secondary_direction numeric DEFAULT 225
) RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public, extensions, pg_temp AS $$
  WITH points AS (
    SELECT source_point_id,
      CASE WHEN source_point_id::text LIKE '1111%' THEN 32.8 ELSE 33.1 END AS latitude,
      CASE WHEN source_point_id::text LIKE '1111%' THEN -117.3 ELSE -117.6 END AS longitude
    FROM unnest(p_source_points) source_point_id
  ), payloads AS (
    SELECT points.*, jsonb_build_object(
      'time',(SELECT jsonb_agg(to_char(p_run::timestamptz+make_interval(hours=>slot),'YYYY-MM-DD"T"HH24:MI') ORDER BY slot) FROM generate_series(0,23) slot),
      'swell_wave_height',(SELECT jsonb_agg(p_height ORDER BY slot) FROM generate_series(0,23) slot),
          'swell_wave_period',(SELECT jsonb_agg(p_primary_period ORDER BY slot) FROM generate_series(0,23) slot),
      'swell_wave_direction',(SELECT jsonb_agg(170 ORDER BY slot) FROM generate_series(0,23) slot),
      'secondary_swell_wave_height',(SELECT jsonb_agg(p_secondary_height ORDER BY slot) FROM generate_series(0,23) slot),
      'secondary_swell_wave_period',(SELECT jsonb_agg(p_secondary_period ORDER BY slot) FROM generate_series(0,23) slot),
      'secondary_swell_wave_direction',(SELECT jsonb_agg(p_secondary_direction ORDER BY slot) FROM generate_series(0,23) slot)
    ) AS hourly
    FROM points
  ), semantic AS (
    SELECT payloads.*, jsonb_build_object(
      'latitude',latitude,'longitude',longitude,'utc_offset_seconds',0,'timezone','GMT','timezone_abbreviation','GMT','elevation',0,
      'hourly_units','{"time":"iso8601","swell_wave_height":"m","swell_wave_period":"s","swell_wave_direction":"°","secondary_swell_wave_height":"m","secondary_swell_wave_period":"s","secondary_swell_wave_direction":"°"}'::jsonb,
      'hourly',hourly
    ) AS semantic_payload
    FROM payloads
  ), evidence AS (
    SELECT semantic.*, semantic_payload || jsonb_build_object('generationtime_ms',p_generationtime) AS raw_payload
    FROM semantic
  )
  SELECT jsonb_agg(jsonb_build_object(
    'sourcePointId', source_point_id,
    'receipt', jsonb_build_object(
      'schemaVersion', 'open-meteo-single-runs-receipt.v1',
      'parserVersion', 'open-meteo-single-runs-receipt.v1',
      'requested', jsonb_build_object(
        'canonicalRequest', jsonb_build_object(
          'method', 'GET',
          'url', format(
            'https://single-runs-api.open-meteo.com/v1/forecast?latitude=%s&longitude=%s&models=ncep_gfswave016&hourly=swell_wave_height%%2Cswell_wave_period%%2Cswell_wave_direction%%2Csecondary_swell_wave_height%%2Csecondary_swell_wave_period%%2Csecondary_swell_wave_direction&run=%s&cell_selection=sea&timezone=UTC&forecast_days=1',
            latitude,
            longitude,
            replace(left(p_run, 16), ':', '%3A')
          ),
          'requestedRunUtc', p_run
        ),
        'runUtc', p_run,
        'model', 'ncep_gfswave016',
        'transportProvider', 'open_meteo_single_runs',
        'upstreamModelProvider', 'ncep'
      ),
      'rawResponse', raw_payload::text,
      'canonicalSemanticPayload', semantic_payload::text,
      'rawResponseSha256', encode(extensions.digest(raw_payload::text,'sha256'),'hex'),
      'revisionHash', encode(extensions.digest(semantic_payload::text,'sha256'),'hex'),
      'qualification', jsonb_build_object(
        'status', 'prototype_unqualified',
        'reason', 'provider_response_does_not_echo_run_and_completion_not_operationally_proven'
      ),
      'hourlyUnits', '{"time":"iso8601","swell_wave_height":"m","swell_wave_period":"s","swell_wave_direction":"°","secondary_swell_wave_height":"m","secondary_swell_wave_period":"s","secondary_swell_wave_direction":"°"}'::jsonb,
      'selectedGrid', jsonb_build_object(
        'latitude', latitude,
        'longitude', longitude,
        'elevationM', 0,
        'distanceFromRequestedKm', 0,
        'policy', jsonb_build_object('status', 'prototype_local_mapping_policy', 'maxDistanceKm', 30, 'providerGuarantee', false)
      ),
      'observations', (
        SELECT jsonb_agg(jsonb_build_object(
          'providerForecastAt', to_char(p_run::timestamptz + make_interval(hours => slot), 'YYYY-MM-DD"T"HH24:MI'),
          'forecastAtUtc', to_char(p_run::timestamptz + make_interval(hours => slot), 'YYYY-MM-DD"T"HH24:MI"Z"'),
          'timeProvenance', jsonb_build_object('field', 'time', 'timezone', 'UTC'),
          'components', jsonb_build_array(
            jsonb_build_object('sourceSlot', 's1', 'heightM', p_height, 'periodS', p_primary_period, 'directionDeg', 170, 'rawFieldProvenance', jsonb_build_object('height', 'swell_wave_height', 'period', 'swell_wave_period', 'direction', 'swell_wave_direction')),
            jsonb_build_object('sourceSlot', 's2', 'heightM', p_secondary_height, 'periodS', p_secondary_period, 'directionDeg', p_secondary_direction, 'rawFieldProvenance', jsonb_build_object('height', 'secondary_swell_wave_height', 'period', 'secondary_swell_wave_period', 'direction', 'secondary_swell_wave_direction'))
          )
        ) ORDER BY slot)
        FROM generate_series(0, 23) slot
      )
    )
  ) ORDER BY source_point_id)
  FROM evidence;
$$;

CREATE TEMP TABLE fixture_receipt_ids AS
SELECT * FROM public.record_swell_watch_provider_run_receipt(
  public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.2,1)
);

DO $$
DECLARE retry record; changed_raw record; corrected record;
  invalid_payload jsonb;
BEGIN
  SELECT * INTO retry FROM public.record_swell_watch_provider_run_receipt(
    public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.2,1)
  );
  IF retry.issuance_id <> (SELECT issuance_id FROM fixture_receipt_ids)
    OR retry.run_batch_id <> (SELECT run_batch_id FROM fixture_receipt_ids)
    OR retry.revision_set_id <> (SELECT revision_set_id FROM fixture_receipt_ids) THEN
    RAISE EXCEPTION 'exact receipt retry was not idempotent';
  END IF;

  SELECT * INTO changed_raw FROM public.record_swell_watch_provider_run_receipt(
    public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.2,2)
  );
  IF changed_raw.revision_set_id <> retry.revision_set_id
    OR (SELECT count(*) FROM public.swell_watch_provider_run_revision_raw_responses) <> 4 THEN
    RAISE EXCEPTION 'same semantic response did not retain raw representations';
  END IF;

  invalid_payload := jsonb_set(public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.2,2),'{0,receipt,revisionHash}',to_jsonb(repeat('f',64)));
  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(invalid_payload);
    RAISE EXCEPTION 'conflicting semantic hash unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'conflicting semantic hash unexpectedly succeeded' THEN RAISE; END IF;
  END;

  SELECT * INTO corrected FROM public.record_swell_watch_provider_run_receipt(
    public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3)
  );
  IF corrected.issuance_id <> retry.issuance_id OR corrected.run_batch_id <> retry.run_batch_id
    OR corrected.revision_set_id = retry.revision_set_id
    OR (SELECT max(revision_number) FROM public.swell_watch_provider_run_revision_sets WHERE batch_id=retry.run_batch_id) <> 2 THEN
    RAISE EXCEPTION 'same-run correction lineage failed';
  END IF;
  UPDATE fixture_receipt_ids SET revision_set_id=corrected.revision_set_id;

  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(
      public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3,ARRAY['11111111-1111-4111-8111-111111111111'::uuid])
    );
    RAISE EXCEPTION 'partial frozen-scope retry unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'partial frozen-scope retry unexpectedly succeeded' THEN RAISE; END IF;
  END;

  invalid_payload := jsonb_set(
    public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3),
    '{0,receipt,hourlyUnits,swell_wave_height}',
    '"ft"'::jsonb
  );
  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(invalid_payload);
    RAISE EXCEPTION 'invalid units unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'invalid units unexpectedly succeeded' THEN RAISE; END IF;
  END;

  invalid_payload := jsonb_set(
    public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3),
    '{0,receipt,rawResponse}',
    to_jsonb(repeat(' ',524289) || '{}')
  );
  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(invalid_payload);
    RAISE EXCEPTION 'oversized raw evidence unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'oversized raw evidence unexpectedly succeeded' THEN RAISE; END IF;
    IF SQLERRM <> 'provider receipt content exceeds durable limit' THEN RAISE; END IF;
  END;

  invalid_payload := public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3) #- '{0,receipt,selectedGrid,latitude}';
  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(invalid_payload);
    RAISE EXCEPTION 'missing selected-grid latitude unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'missing selected-grid latitude unexpectedly succeeded' THEN RAISE; END IF;
  END;

  invalid_payload := jsonb_set(
    public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3),
    '{0,receipt,selectedGrid,latitude}',
    '40'::jsonb
  );
  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(invalid_payload);
    RAISE EXCEPTION 'forged selected-grid distance unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'forged selected-grid distance unexpectedly succeeded' THEN RAISE; END IF;
  END;

  invalid_payload := jsonb_set(
    public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3),
    '{0,receipt,observations,0,components,0,rawFieldProvenance,height}',
    '"wave_height"'::jsonb
  );
  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(invalid_payload);
    RAISE EXCEPTION 'invalid field provenance unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'invalid field provenance unexpectedly succeeded' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.record_swell_watch_provider_run_receipt(
      public.fixture_provider_run_scopes('2026-09-03T06:00Z',1.3,3,ARRAY[
        '11111111-1111-4111-8111-111111111111'::uuid,
        '11111111-1111-4111-8111-111111111111'::uuid
      ])
    );
    RAISE EXCEPTION 'duplicate source point unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'duplicate source point unexpectedly succeeded' THEN RAISE; END IF;
  END;

  BEGIN
    PERFORM public.complete_swell_watch_provider_run_receipt(corrected.revision_set_id);
    RAISE EXCEPTION 'completion without attestation unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'completion without attestation unexpectedly succeeded' THEN RAISE; END IF;
  END;
END;
$$;

SELECT set_config('app.swell_watch_internal_write', 'on', false);
INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',(SELECT revision_set_id FROM fixture_receipt_ids),'rejected','fixture-reviewer',repeat('f',64),'fixture-contract');

DO $$ BEGIN
  BEGIN
    PERFORM public.complete_swell_watch_provider_run_receipt((SELECT revision_set_id FROM fixture_receipt_ids));
    RAISE EXCEPTION 'rejected attestation unexpectedly completed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'rejected attestation unexpectedly completed' THEN RAISE; END IF;
  END;
END; $$;

INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',(SELECT revision_set_id FROM fixture_receipt_ids),'accepted','fixture-reviewer',repeat('1',64),'fixture-contract');

CREATE TEMP TABLE fixture_completed_ids AS
SELECT * FROM public.complete_swell_watch_provider_run_receipt((SELECT revision_set_id FROM fixture_receipt_ids));

DO $$
DECLARE replay record;
BEGIN
  SELECT * INTO replay FROM public.complete_swell_watch_provider_run_receipt((SELECT revision_set_id FROM fixture_receipt_ids));
  IF replay.provider_batch_id<>(SELECT provider_batch_id FROM fixture_completed_ids)
    OR replay.evaluation_id<>(SELECT evaluation_id FROM fixture_completed_ids) THEN
    RAISE EXCEPTION 'completion replay was not idempotent';
  END IF;
END; $$;

DO $$ BEGIN
  IF (SELECT evaluation_id FROM fixture_completed_ids) <> 'genuine_completed:' || (SELECT run_batch_id FROM fixture_receipt_ids) THEN
    RAISE EXCEPTION 'completed evaluation identity was not batch-derived';
  END IF;
END; $$;

CREATE TEMP TABLE fixture_second_run_ids AS
SELECT * FROM public.record_swell_watch_provider_run_receipt(
  public.fixture_provider_run_scopes('2026-09-03T12:00Z',1.2,1)
);
DO $$ BEGIN
  IF (SELECT issuance_id FROM fixture_second_run_ids)=(SELECT issuance_id FROM fixture_receipt_ids)
    OR (SELECT run_batch_id FROM fixture_second_run_ids)=(SELECT run_batch_id FROM fixture_receipt_ids) THEN
    RAISE EXCEPTION 'distinct run reused provider identity';
  END IF;
END; $$;

INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',(SELECT revision_set_id FROM fixture_second_run_ids),'accepted','fixture-reviewer',repeat('8',64),'fixture-contract');
CREATE TEMP TABLE fixture_second_completed_ids AS
SELECT * FROM public.complete_swell_watch_provider_run_receipt((SELECT revision_set_id FROM fixture_second_run_ids));
SELECT public.ingest_verified_swell_watch_evaluation(
  (SELECT provider_batch_id FROM fixture_second_completed_ids),
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb101','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb102','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103',
  '11111111-1111-4111-8111-111111111111','southern-california','provider-correction-fixture','2026-09-03T12:00Z','s1',1.2,12,170,2,
  'fixture-policy',repeat('4',64),repeat('5',64),'2026-09-06T12:00Z','2026-09-06T18:00Z'
);
SELECT public.append_swell_watch_state_transition(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb104','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103',0,'candidate',
  'genuine_completed:' || (SELECT run_batch_id FROM fixture_second_run_ids)
);
CREATE TEMP TABLE fixture_second_correction_ids AS
SELECT * FROM public.record_swell_watch_provider_run_receipt(
  public.fixture_provider_run_scopes('2026-09-03T12:00Z',1.5,2)
);
DO $$ BEGIN
  IF (SELECT reason_code FROM public.swell_watch_validate_notification_release(
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb105'
  )) <> 'provider_evidence_unavailable' THEN
    RAISE EXCEPTION 'older completed revision remained releasable after correction';
  END IF;
END; $$;
INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref)
VALUES ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2',(SELECT revision_set_id FROM fixture_second_correction_ids),'accepted','fixture-reviewer',repeat('9',64),'fixture-contract');
CREATE TEMP TABLE fixture_second_correction_completed AS
SELECT * FROM public.complete_swell_watch_provider_run_receipt((SELECT revision_set_id FROM fixture_second_correction_ids));
DO $$ BEGIN
  BEGIN
    PERFORM public.ingest_verified_swell_watch_evaluation(
      (SELECT provider_batch_id FROM fixture_second_correction_completed),
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb111','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb112','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103',
      '11111111-1111-4111-8111-111111111111','southern-california','provider-correction-fixture','2026-09-03T12:00Z','s1',1.5,12,170,2,
      'fixture-policy',repeat('4',64),repeat('5',64),'2026-09-06T12:00Z','2026-09-06T18:00Z'
    );
    RAISE EXCEPTION 'post-ingest correction unexpectedly created another evaluation';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='post-ingest correction unexpectedly created another evaluation' THEN RAISE; END IF;
    IF SQLERRM<>'provider correction requires evaluation suppression' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM public.swell_watch_event_evaluations WHERE regional_event_id='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbb103')<>1 THEN
    RAISE EXCEPTION 'post-ingest correction changed evaluation count';
  END IF;
END; $$;

SELECT public.ingest_verified_swell_watch_evaluation(
  (SELECT provider_batch_id FROM fixture_completed_ids),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa101','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa102','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa103',
  '11111111-1111-4111-8111-111111111111','southern-california','provider-receipt-fixture','2026-09-03T06:00Z','s1',1.3,12,170,2,
  'fixture-policy',repeat('4',64),repeat('5',64),'2026-09-06T12:00Z','2026-09-06T18:00Z'
);
SELECT public.append_swell_watch_state_transition(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa104','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa103',0,'candidate',
  'genuine_completed:' || (SELECT run_batch_id FROM fixture_receipt_ids)
);

DO $$ BEGIN
  BEGIN
    INSERT INTO public.swell_watch_provider_run_attestations (revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref,revokes_attestation_id)
    SELECT other.id,'revoked','fixture-reviewer',repeat('6',64),'fixture-contract','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
    FROM public.swell_watch_provider_run_revision_sets other WHERE other.id<>(SELECT revision_set_id FROM fixture_receipt_ids) LIMIT 1;
    RAISE EXCEPTION 'cross-subject attestation revocation unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'cross-subject attestation revocation unexpectedly succeeded' THEN RAISE; END IF;
  END;
END; $$;

INSERT INTO public.swell_watch_provider_run_attestations (id,revision_set_id,state,reviewer,evidence_sha256,provider_contract_ref,revokes_attestation_id)
VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',(SELECT revision_set_id FROM fixture_receipt_ids),'revoked','fixture-reviewer',repeat('7',64),'fixture-contract','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2');

SELECT public.ingest_verified_swell_watch_evaluation(
  (SELECT provider_batch_id FROM fixture_second_correction_completed),
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa121','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa122','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa103',
  '11111111-1111-4111-8111-111111111111','southern-california','provider-receipt-fixture','2026-09-03T13:00Z','s1',1.5,12,170,2,
  'fixture-policy',repeat('4',64),repeat('5',64),'2026-09-06T12:00Z','2026-09-06T18:00Z'
);

DO $$ BEGIN
  BEGIN
    PERFORM public.ingest_verified_swell_watch_evaluation(
      (SELECT provider_batch_id FROM fixture_completed_ids),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa112','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa113',
      '11111111-1111-4111-8111-111111111111','southern-california','provider-receipt-fixture','2026-09-03T07:00Z','s1',1.3,12,170,2,
      'fixture-policy',repeat('4',64),repeat('5',64),'2026-09-06T12:00Z','2026-09-06T18:00Z'
    );
    RAISE EXCEPTION 'revoked provider evidence unexpectedly ingested';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'revoked provider evidence unexpectedly ingested' THEN RAISE; END IF;
  END;
  IF (SELECT reason_code FROM public.swell_watch_validate_notification_release(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa103','11111111-1111-4111-8111-111111111111','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',now(),'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaa114'
  )) <> 'provider_evidence_unavailable' THEN
    RAISE EXCEPTION 'release did not fail closed after attestation revocation';
  END IF;
END; $$;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.swell_watch_provider_run_issuances) <> 2
    OR (SELECT count(*) FROM public.swell_watch_provider_run_batches) <> 2
    OR (SELECT count(*) FROM public.swell_watch_observations WHERE identity_kind='genuine_completed') <> 3 THEN
    RAISE EXCEPTION 'provider receipt final counts are unexpected';
  END IF;
END; $$;
