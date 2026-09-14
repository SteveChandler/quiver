-- Epoch 4 widens only the no-send study authority contract. No stored evidence is rewritten.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $constraint$
DECLARE current_definition text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT pg_get_constraintdef(c.oid) INTO current_definition
  FROM pg_constraint c WHERE c.conrelid='public.swell_watch_study_authorities'::regclass
    AND c.conname='swell_watch_study_authorities_qualification_rule_check';
  IF current_definition = $$CHECK ((qualification_rule = ANY (ARRAY['complete_partitions.v1'::text, 'primary_partition_with_retained_unavailable_secondary.v1'::text, 'model_reported_partition_count.v1'::text])))$$ THEN RETURN; END IF;
  ALTER TABLE public.swell_watch_study_authorities DROP CONSTRAINT IF EXISTS swell_watch_study_authorities_qualification_rule_check;
  ALTER TABLE public.swell_watch_study_authorities ADD CONSTRAINT swell_watch_study_authorities_qualification_rule_check
    CHECK (qualification_rule IN ('complete_partitions.v1','primary_partition_with_retained_unavailable_secondary.v1','model_reported_partition_count.v1'));
END;
$constraint$;

-- record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb): pre e0e0e7f5d09ce8e3d2b668dd4c022ed429ff38d57473ae803ee093620c9f5521; post d6ce951daa3bb58b6b5228732ce7fcd9263c0cb894863362258d923ad53dc817.
DO $amend$
DECLARE definition text; old_coverage text; new_coverage text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF position('absent partition requires a valid primary partition' in definition)>0 THEN
    IF encode(extensions.digest(definition,'sha256'),'hex')<>'d6ce951daa3bb58b6b5228732ce7fcd9263c0cb894863362258d923ad53dc817' THEN
      RAISE EXCEPTION 'record_swell_watch_study_evaluation differs from reviewed epoch 4 definition';
    END IF;
    RETURN;
  END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'e0e0e7f5d09ce8e3d2b668dd4c022ed429ff38d57473ae803ee093620c9f5521' THEN
    RAISE EXCEPTION 'record_swell_watch_study_evaluation differs from reviewed baseline';
  END IF;
  definition := replace(definition,
    'scope jsonb; slot text; observed numeric; unavailable numeric; stored_unavailable bigint;',
    'scope jsonb; slot text; observed numeric; unavailable numeric; absent numeric; stored_zero_tuples bigint; stored_invalid_absent bigint;');
  old_coverage := $old$
      FOREACH slot IN ARRAY ARRAY['s1','s2'] LOOP
        IF jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'observed']) IS DISTINCT FROM 'number'
          OR jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'unavailable']) IS DISTINCT FROM 'number' THEN
          RAISE EXCEPTION 'invalid study partition coverage';
        END IF;
        observed := (scope #>> ARRAY['partitionCoverage',slot,'observed'])::numeric;
        unavailable := (scope #>> ARRAY['partitionCoverage',slot,'unavailable'])::numeric;
        IF observed<0 OR unavailable<0 OR trunc(observed)<>observed OR trunc(unavailable)<>unavailable
          OR observed+unavailable<>168 OR (slot='s1' AND unavailable<>0) THEN
          RAISE EXCEPTION 'invalid study partition coverage';
        END IF;
        IF slot='s2' AND unavailable>0 AND p_result->>'status'='evaluated'
          AND a.qualification_rule<>'primary_partition_with_retained_unavailable_secondary.v1' THEN
          RAISE EXCEPTION 'study result claims partial partition coverage under complete-partition rule';
        END IF;
        SELECT CASE WHEN slot='s2' THEN count(*) FILTER (WHERE c.unavailable_reason IS NOT NULL AND c.source_slot='s2')
          ELSE count(*) FILTER (WHERE c.unavailable_reason IS NOT NULL AND c.source_slot='s1') END INTO stored_unavailable
          FROM public.swell_watch_provider_run_completed_batches b
          JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
          JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id AND s.batch_id=b.batch_id
          JOIN public.swell_watch_provider_run_revision_components c ON c.revision_id=m.revision_id
          WHERE b.id=p_provider_batch_id AND s.source_point_id::text=scope->>'sourcePointId';
        IF unavailable IS DISTINCT FROM stored_unavailable THEN
          RAISE EXCEPTION 'study partition coverage differs from retained components';
        END IF;
      END LOOP;
$old$;
  new_coverage := $new$
      FOREACH slot IN ARRAY ARRAY['s1','s2'] LOOP
        IF jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'observed']) IS DISTINCT FROM 'number'
          OR jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'unavailable']) IS DISTINCT FROM 'number'
          OR (scope #> ARRAY['partitionCoverage',slot,'absent'] IS NOT NULL
            AND jsonb_typeof(scope #> ARRAY['partitionCoverage',slot,'absent']) IS DISTINCT FROM 'number') THEN
          RAISE EXCEPTION 'invalid study partition coverage';
        END IF;
        observed := (scope #>> ARRAY['partitionCoverage',slot,'observed'])::numeric;
        unavailable := (scope #>> ARRAY['partitionCoverage',slot,'unavailable'])::numeric;
        absent := coalesce((scope #>> ARRAY['partitionCoverage',slot,'absent'])::numeric,0);
        IF observed<0 OR unavailable<0 OR absent<0 OR trunc(observed)<>observed OR trunc(unavailable)<>unavailable OR trunc(absent)<>absent
          OR observed+unavailable+absent<>168 OR (slot='s1' AND (unavailable<>0 OR absent<>0)) THEN
          RAISE EXCEPTION 'invalid study partition coverage';
        END IF;
        SELECT count(*) FILTER (WHERE c.unavailable_reason IS NOT NULL AND c.source_slot=slot) INTO stored_zero_tuples
          FROM public.swell_watch_provider_run_completed_batches b
          JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
          JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id AND s.batch_id=b.batch_id
          JOIN public.swell_watch_provider_run_revision_components c ON c.revision_id=m.revision_id
          WHERE b.id=p_provider_batch_id AND s.source_point_id::text=scope->>'sourcePointId';
        IF slot='s1' AND stored_zero_tuples<>0 THEN RAISE EXCEPTION 'study partition coverage differs from retained components'; END IF;
        IF slot='s2' AND ((a.qualification_rule='complete_partitions.v1' AND p_result->>'status'='evaluated' AND (unavailable<>0 OR absent<>0))
          OR (a.qualification_rule='primary_partition_with_retained_unavailable_secondary.v1' AND (unavailable IS DISTINCT FROM stored_zero_tuples OR absent<>0))
          OR (a.qualification_rule='model_reported_partition_count.v1' AND (absent IS DISTINCT FROM stored_zero_tuples OR unavailable<>0))) THEN
          RAISE EXCEPTION 'study partition coverage differs from retained components';
        END IF;
      END LOOP;
      IF a.qualification_rule='model_reported_partition_count.v1' THEN
        SELECT count(*) INTO stored_invalid_absent
        FROM public.swell_watch_provider_run_completed_batches b
        JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
        JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id AND s.batch_id=b.batch_id
        JOIN public.swell_watch_provider_run_revision_components secondary ON secondary.revision_id=m.revision_id
        LEFT JOIN public.swell_watch_provider_run_revision_components primary_component ON primary_component.revision_id=m.revision_id
          AND primary_component.source_slot='s1' AND primary_component.forecast_at=secondary.forecast_at
        WHERE b.id=p_provider_batch_id AND s.source_point_id::text=scope->>'sourcePointId'
          AND secondary.source_slot='s2' AND secondary.unavailable_reason IS NOT NULL
          AND (primary_component.unavailable_reason IS NOT NULL OR primary_component.revision_id IS NULL);
        IF stored_invalid_absent<>0 THEN RAISE EXCEPTION 'absent partition requires a valid primary partition'; END IF;
      END IF;
$new$;
  definition := replace(definition, old_coverage, new_coverage);
  IF position('absent partition requires a valid primary partition' in definition)=0 THEN RAISE EXCEPTION 'reviewed coverage block not found'; END IF;
  EXECUTE definition;
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'d6ce951daa3bb58b6b5228732ce7fcd9263c0cb894863362258d923ad53dc817' THEN
    RAISE EXCEPTION 'model partition count definition hash mismatch';
  END IF;
END;
$amend$;
COMMIT;
