-- Epoch 5: both provider zero tuples mean the model reports zero swell systems.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

DO $constraint$
DECLARE current_definition text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT pg_get_constraintdef(c.oid) INTO current_definition FROM pg_constraint c
    WHERE c.conrelid='public.swell_watch_study_authorities'::regclass AND c.conname='swell_watch_study_authorities_qualification_rule_check';
  IF current_definition = $$CHECK ((qualification_rule = ANY (ARRAY['complete_partitions.v1'::text, 'primary_partition_with_retained_unavailable_secondary.v1'::text, 'model_reported_partition_count.v1'::text, 'model_reported_swell_system_count.v1'::text])))$$ THEN RETURN; END IF;
  ALTER TABLE public.swell_watch_study_authorities DROP CONSTRAINT IF EXISTS swell_watch_study_authorities_qualification_rule_check;
  ALTER TABLE public.swell_watch_study_authorities ADD CONSTRAINT swell_watch_study_authorities_qualification_rule_check
    CHECK (qualification_rule IN ('complete_partitions.v1','primary_partition_with_retained_unavailable_secondary.v1','model_reported_partition_count.v1','model_reported_swell_system_count.v1'));
END;
$constraint$;

-- record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb): pre d6ce951daa3bb58b6b5228732ce7fcd9263c0cb894863362258d923ad53dc817; post d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03.
DO $amend$
DECLARE definition text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'d6ce951daa3bb58b6b5228732ce7fcd9263c0cb894863362258d923ad53dc817' THEN
    RAISE EXCEPTION 'record_swell_watch_study_evaluation differs from reviewed epoch 4 definition';
  END IF;
  definition := replace(definition, 'OR observed+unavailable+absent<>168 OR (slot=''s1'' AND (unavailable<>0 OR absent<>0))',
    'OR observed+unavailable+absent<>168 OR (slot=''s1'' AND unavailable<>0)');
  definition := replace(definition, 'IF slot=''s1'' AND stored_zero_tuples<>0 THEN RAISE EXCEPTION ''study partition coverage differs from retained components''; END IF;',
    'IF slot=''s1'' AND a.qualification_rule<>''model_reported_swell_system_count.v1'' AND stored_zero_tuples<>0 THEN RAISE EXCEPTION ''study partition coverage differs from retained components''; END IF;
        IF a.qualification_rule=''model_reported_swell_system_count.v1'' AND absent IS DISTINCT FROM stored_zero_tuples THEN RAISE EXCEPTION ''study partition coverage differs from retained components''; END IF;');
  definition := replace(definition, 'OR (a.qualification_rule=''model_reported_partition_count.v1'' AND (absent IS DISTINCT FROM stored_zero_tuples OR unavailable<>0)))',
    'OR (a.qualification_rule=''model_reported_partition_count.v1'' AND (absent IS DISTINCT FROM stored_zero_tuples OR unavailable<>0))
          OR (a.qualification_rule=''model_reported_swell_system_count.v1'' AND (absent IS DISTINCT FROM stored_zero_tuples OR unavailable<>0)))');
  definition := replace(definition, '  END IF;
  digest :=', '  END IF;
    IF a.qualification_rule=''model_reported_swell_system_count.v1'' AND EXISTS(SELECT 1 FROM public.swell_watch_provider_run_completed_batches b
      JOIN public.swell_watch_provider_run_revision_set_members m ON m.revision_set_id=b.revision_set_id
      JOIN public.swell_watch_provider_run_batch_scopes s ON s.id=m.scope_id AND s.batch_id=b.batch_id
      JOIN public.swell_watch_provider_run_revision_components primary_component ON primary_component.revision_id=m.revision_id
      LEFT JOIN public.swell_watch_provider_run_revision_components secondary_component ON secondary_component.revision_id=m.revision_id AND secondary_component.source_slot=''s2'' AND secondary_component.forecast_at=primary_component.forecast_at
      WHERE b.id=p_provider_batch_id AND s.source_point_id::text=scope->>''sourcePointId'' AND primary_component.source_slot=''s1'' AND primary_component.unavailable_reason IS NOT NULL
        AND (secondary_component.unavailable_reason IS NULL OR secondary_component.revision_id IS NULL)) THEN
      RAISE EXCEPTION ''absent primary partition requires absent secondary partition'';
    END IF;
  digest :=');
  EXECUTE definition;
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'d1165986abe16e5c177a4d778dfa0f23ddd9d2b7407ee81c07755e39364c9f03' THEN
    RAISE EXCEPTION 'model-reported swell system count definition hash mismatch';
  END IF;
END;
$amend$;
COMMIT;
