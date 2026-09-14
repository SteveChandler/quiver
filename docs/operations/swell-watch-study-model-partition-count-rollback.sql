-- Run only after epoch 4 is revoked. Keep the widened qualification-rule constraint:
-- revoked authority rows can legally retain model_reported_partition_count.v1.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $rollback$
DECLARE definition text;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='e0e0e7f5d09ce8e3d2b668dd4c022ed429ff38d57473ae803ee093620c9f5521' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'ae1589a145a508cf2d83c9ac21d4c9396be377d6c469471a4ea0a3fd735c5eab' THEN
    RAISE EXCEPTION 'record_swell_watch_study_evaluation differs from reviewed epoch 4 definition';
  END IF;
  -- The epoch-3 definition is retained verbatim in the reviewed predecessor migration.
  RAISE EXCEPTION 'apply the reviewed e0e0e7f5 definition from 20260914050000 before executing this rollback';
END;
$rollback$;
COMMIT;
