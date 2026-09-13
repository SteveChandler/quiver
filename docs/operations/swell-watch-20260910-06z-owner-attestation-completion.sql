-- DRAFT: execute only as production owner after a NEW exact approval token for the companion plan.
-- This records one accepted no-send attestation and completes its existing receipt. It creates no policy,
-- provider receipt, evaluation, demand, notification, enqueue, or push authority.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '30s';

DO $operation$
DECLARE
  v_manifest_text constant text := $manifest${"issuanceId":"58713376-6e62-4c12-8a1a-170e0b30026e","runUtc":"2026-09-10T06:00:00Z","runBatchId":"c89b1ec0-6ab0-461e-97b8-e3495696e573","revisionSetId":"ac1bf4d5-0fd9-40a0-b16c-090a19794ed5","revisionNumber":1,"scopeHash":"2a07d88c0b1d4ab9c04fc8bcdc72f8363a3d850c3d622a55e155374ec0428242","revisionSetHash":"4cebbb10597677f18b3d17945fcdaa89ee722af3e64df0128a0da33823a8e554","expectedComponents":3360,"missing":{"sourcePointId":"d264fbf8-0525-4d31-adb5-9a0742eaeb7e","sourceSlot":"s2","reason":"provider_zero_tuple","count":27},"scopes":[["01330afc-00d3-461b-88f3-b173774766f4","2ec6e2814a64ac6713a20cb0a87f9ac675a36c6db20271e17962ad6997cdad28","bf08b79c2f6316d83ea9f7b4683ee5c4fbb79a5ff44a3eb71b72c10decf06239"],["025cfc18-8357-49d6-994e-e0abf0a16f6d","1bbca8dd585373eef283bb8e04566ed0a2b213bc7eaddcdd5e70e1dedebf8af4","0b0bce8b0cd344f7add70d91062d04a66558451c55b2ec1fec8ef06621b95c9d"],["2609a9ff-d247-4e0b-888f-a793ff7177a5","3fa1aa53f1e4f1e3846888374543521c8705eff8f71cb51f8bfa9d0210405d15","5deec1e1685960710ea98a4074f11aa3a48f96dfc73f2965f9f7f298ec4dd3b8"],["2ac8b200-fdf2-4822-bcb1-3ec336b83d05","04eca65b054e85d32bdfa4f915539b2e56cb364b89dd8e6cf8e1e97de8ffb0f8","62f61dc93f4ec5e037a58c354c304bce6e719f29a688df6fc2b9493b3ca20804"],["4b0cf129-c706-4e24-8210-2219defc5ea7","25f816561a5cdc6a0ef89bae759cd2179c952e646034dd3aa6da01f6c004c08c","1e43ed00842dfc659a5005a9fe5d18b6d51a6def34aabb641051c50aa8454a4d"],["6a0674ac-3e6d-49f3-9fd4-a4f1857c408a","1a77be6b974836a6007218cbe08554bb7ec6b59ceeadda8e08a3ba81e57f4cdf","e562d010d5aef63808a4a183465d89b83e3bea744ed33311fd37389f90d9d2c9"],["72726bcb-bed0-4b76-8336-f90d7fb57159","729ffc3e922ce3875e5e994bc9f1f69dcc8aac15cfd7a0ccd75239b479b2833b","5adbcbcc07a7b96ca87c1dc79e77ca423453cd0c2c8dfb809fd95372a3c4cbe8"],["d264fbf8-0525-4d31-adb5-9a0742eaeb7e","71d07c74ec1e1126b8a0478f7ecd51f96d7b6c7aeba1ac505a6b6c53b610c9cf","1d6365ac2bedc7d7e5e316c353c1ecda2ac90a5d80e60eb8208bed3569d3c55c"],["e8a921b7-c2b5-4259-9e5c-bd06765f7ae4","b1e556ab85c822da90d1310a8b20c2f4171f08b671cd434c01a39616e1ec4b15","048a0a1603a9a43fdb76c0d4a34d9c8ea9be7cf11bd24bee58e40f53bf72ad2c"],["f11ccd59-b778-4ea1-a8ff-88bffb447cd8","b76d186cac2238cba8c923a8ce479e1dda8e8bc13cef242020c13b5d78ced25f","b3cf534ae7c015a49f831d583f8f526c942239a4114f54998ae9697d83a90cf6"]]}$manifest$;
  v_manifest jsonb := v_manifest_text::jsonb;
  v_evidence_sha constant text := '62af9c7086ea09e83f3ec5c0313c716024f8376c173255510cb7e6210a416f4d';
  v_attestation_id constant uuid := '5425696b-1363-4e9c-be1a-67829c89b141';
  v_reviewer constant text := 'Steven Chandler (owner approval recorded by exact plan token)';
  v_contract_ref constant text := 'Open-Meteo Single Runs 06Z audit manifest; internal no-send evaluation only; 2026-09-10';
  v_policy_hash constant text := '86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f';
  v_policy_evidence constant text := '6ac158d19ffd55505609efae9ce6b634bea9d92342c133333fdc91fe29471403';
  v_issuance uuid := '58713376-6e62-4c12-8a1a-170e0b30026e';
  v_batch uuid := 'c89b1ec0-6ab0-461e-97b8-e3495696e573';
  v_revision_set uuid := 'ac1bf4d5-0fd9-40a0-b16c-090a19794ed5';
  v_run_utc constant timestamptz := timestamptz '2026-09-10T06:00:00Z';
  v_scope_hash constant text := '2a07d88c0b1d4ab9c04fc8bcdc72f8363a3d850c3d622a55e155374ec0428242';
  v_revision_set_hash constant text := '4cebbb10597677f18b3d17945fcdaa89ee722af3e64df0128a0da33823a8e554';
  v_control_state text;
  v_policy public.swell_watch_evaluation_policies%ROWTYPE;
  v_attestations integer;
  v_completions integer;
  v_completed_batch uuid;
  v_evaluation_id text;
BEGIN
  IF encode(extensions.digest(v_manifest_text, 'sha256'), 'hex') IS DISTINCT FROM v_evidence_sha THEN
    RAISE EXCEPTION 'owner-attestation audit manifest checksum mismatch';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-completed-provider-frontier', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-provider-run:2026-09-10T06:00Z', 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('swell-watch-control', 0));
  LOCK TABLE public.swell_watch_evaluation_policies IN SHARE ROW EXCLUSIVE MODE;

  SELECT control.state INTO v_control_state FROM public.swell_watch_get_automation_control() control;
  IF v_control_state IS DISTINCT FROM 'disabled'
    OR EXISTS (SELECT 1 FROM public.swell_watch_get_production_authority()) THEN
    RAISE EXCEPTION 'Swell Watch control must be disabled and push authority absent';
  END IF;
  IF (SELECT count(*) FROM public.swell_watch_evaluation_policies) IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Unexpected evaluation-policy ledger cardinality';
  END IF;
  SELECT * INTO v_policy FROM public.swell_watch_evaluation_policies WHERE epoch = 2;
  IF v_policy.epoch IS DISTINCT FROM 2
    OR v_policy.state IS DISTINCT FROM 'active'
    OR v_policy.policy_hash IS DISTINCT FROM v_policy_hash
    OR v_policy.evidence_hash IS DISTINCT FROM v_policy_evidence
    OR v_policy.expires_at <= clock_timestamp() THEN
    RAISE EXCEPTION 'Current v2 evaluation policy authority is required';
  END IF;

  IF clock_timestamp() < v_run_utc OR clock_timestamp() - v_run_utc > interval '12 hours' THEN
    RAISE EXCEPTION '06Z provider run is outside the approved 12-hour attestation window';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.swell_watch_provider_run_issuances issuance
    JOIN public.swell_watch_provider_run_batches batch ON batch.issuance_id = issuance.id
    JOIN public.swell_watch_provider_run_revision_sets revision_set ON revision_set.batch_id = batch.id
    WHERE issuance.id = v_issuance
      AND issuance.transport_provider = 'open_meteo_single_runs'
      AND issuance.model = 'ncep_gfswave016'
      AND issuance.parser_version = 'open-meteo-single-runs-receipt.v1'
      AND issuance.upstream_model_provider = 'ncep'
      AND issuance.run_utc = v_run_utc
      AND batch.id = v_batch
      AND batch.scope_hash = v_scope_hash
      AND batch.expected_component_count = 3360
      AND revision_set.id = v_revision_set
      AND revision_set.revision_number = 1
      AND revision_set.revision_set_hash = v_revision_set_hash
      AND revision_set.revision_number = (SELECT max(candidate.revision_number) FROM public.swell_watch_provider_run_revision_sets candidate WHERE candidate.batch_id = v_batch)
      AND NOT EXISTS (SELECT 1 FROM public.swell_watch_provider_run_revision_sets other WHERE other.batch_id = v_batch AND other.id <> v_revision_set)
  ) THEN
    RAISE EXCEPTION '06Z issuance, batch, or current revision subject mismatch';
  END IF;

  IF EXISTS (
    WITH expected AS (
      SELECT (scope->>0)::uuid AS source_point_id, scope->>1 AS raw_sha, scope->>2 AS semantic_sha
      FROM jsonb_array_elements(v_manifest->'scopes') scope
    ), actual AS (
      SELECT scope.source_point_id, raw.raw_response_sha256 AS raw_sha, revision.semantic_revision_hash AS semantic_sha
      FROM public.swell_watch_provider_run_revision_set_members member
      JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id = member.scope_id
      JOIN public.swell_watch_provider_run_revisions revision ON revision.id = member.revision_id
      JOIN public.swell_watch_provider_run_revision_raw_responses raw ON raw.revision_id = revision.id
      WHERE member.revision_set_id = v_revision_set
    )
    SELECT 1 FROM expected FULL OUTER JOIN actual USING (source_point_id)
    WHERE expected.raw_sha IS DISTINCT FROM actual.raw_sha OR expected.semantic_sha IS DISTINCT FROM actual.semantic_sha
  ) OR (SELECT count(*) FROM jsonb_array_elements(v_manifest->'scopes')) IS DISTINCT FROM 10 THEN
    RAISE EXCEPTION '06Z raw-response or semantic revision provenance mismatch';
  END IF;
  IF EXISTS (
    WITH expected AS (SELECT (scope->>0)::uuid AS source_point_id FROM jsonb_array_elements(v_manifest->'scopes') scope), actual AS (
      SELECT scope.source_point_id, count(component.*) AS components,
        count(component.*) FILTER (WHERE component.unavailable_reason IS NOT NULL) AS unavailable
      FROM public.swell_watch_provider_run_revision_set_members member
      JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id = member.scope_id
      JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id = member.revision_id
      WHERE member.revision_set_id = v_revision_set GROUP BY scope.source_point_id
    )
    SELECT 1 FROM expected FULL OUTER JOIN actual USING (source_point_id)
    WHERE actual.components IS DISTINCT FROM 336
      OR (expected.source_point_id = 'd264fbf8-0525-4d31-adb5-9a0742eaeb7e'::uuid AND actual.unavailable IS DISTINCT FROM 27)
      OR (expected.source_point_id <> 'd264fbf8-0525-4d31-adb5-9a0742eaeb7e'::uuid AND actual.unavailable IS DISTINCT FROM 0)
  ) OR (SELECT count(*) FROM public.swell_watch_provider_run_revision_set_members member JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id = member.revision_id WHERE member.revision_set_id = v_revision_set) IS DISTINCT FROM 3360
    OR (SELECT count(*) FROM public.swell_watch_provider_run_revision_set_members member JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id = member.scope_id JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id = member.revision_id WHERE member.revision_set_id = v_revision_set AND component.unavailable_reason = 'provider_zero_tuple' AND scope.source_point_id = 'd264fbf8-0525-4d31-adb5-9a0742eaeb7e'::uuid AND component.source_slot = 's2' AND component.height_m = 0 AND component.period_s = 0 AND component.direction_deg = 0) IS DISTINCT FROM 27
    OR EXISTS (SELECT 1 FROM public.swell_watch_provider_run_revision_set_members member JOIN public.swell_watch_provider_run_batch_scopes scope ON scope.id = member.scope_id JOIN public.swell_watch_provider_run_revision_components component ON component.revision_id = member.revision_id WHERE member.revision_set_id = v_revision_set AND component.unavailable_reason IS NOT NULL AND NOT (component.unavailable_reason = 'provider_zero_tuple' AND scope.source_point_id = 'd264fbf8-0525-4d31-adb5-9a0742eaeb7e'::uuid AND component.source_slot = 's2' AND component.height_m = 0 AND component.period_s = 0 AND component.direction_deg = 0)) THEN
    RAISE EXCEPTION '06Z component coverage or explicit missingness mismatch';
  END IF;

  IF EXISTS (SELECT 1 FROM public.swell_watch_recipient_announcements)
    OR EXISTS (SELECT 1 FROM public.swell_watch_notification_event_bindings) THEN
    RAISE EXCEPTION 'Existing Swell Watch notification evidence requires separate review';
  END IF;

  SELECT count(*) INTO v_attestations FROM public.swell_watch_provider_run_attestations WHERE revision_set_id = v_revision_set;
  SELECT count(*) INTO v_completions FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id = v_revision_set;
  IF v_completions = 1 THEN
    SELECT id INTO v_completed_batch FROM public.swell_watch_provider_run_completed_batches WHERE revision_set_id = v_revision_set;
  END IF;
  IF v_attestations = 1 AND v_completions = 1 AND EXISTS (
    SELECT 1 FROM public.swell_watch_provider_run_attestations attestation
    WHERE attestation.id = v_attestation_id AND attestation.revision_set_id = v_revision_set
      AND attestation.state = 'accepted' AND attestation.reviewer = v_reviewer
      AND attestation.evidence_sha256 = v_evidence_sha AND attestation.provider_contract_ref = v_contract_ref
      AND attestation.revokes_attestation_id IS NULL
  ) AND EXISTS (
    SELECT 1 FROM public.swell_watch_provider_run_completed_batches completed
    WHERE completed.id = v_completed_batch AND completed.batch_id = v_batch AND completed.revision_set_id = v_revision_set
  ) THEN
    RETURN;
  END IF;
  IF v_attestations <> 0 OR v_completions <> 0 THEN
    RAISE EXCEPTION 'Conflicting or partial 06Z attestation/completion state';
  END IF;

  PERFORM public.attest_swell_watch_provider_run(v_attestation_id, v_revision_set, 'accepted', v_reviewer, v_evidence_sha, v_contract_ref);
  SELECT provider_batch_id, evaluation_id INTO v_completed_batch, v_evaluation_id
  FROM public.complete_swell_watch_provider_run_receipt(v_revision_set);
  IF v_completed_batch IS NULL OR v_evaluation_id IS DISTINCT FROM 'genuine_completed:' || v_batch THEN
    RAISE EXCEPTION '06Z completion RPC returned an unexpected identity';
  END IF;
END;
$operation$;

COMMIT;
