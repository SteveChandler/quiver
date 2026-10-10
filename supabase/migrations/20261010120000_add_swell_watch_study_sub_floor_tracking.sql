-- Bind sub-floor tracking to a study authority. Every existing epoch keeps tracking_mode 'none', so its
-- config hash, qualifying days and recorded results are unchanged; the app emits tracking rows only after
-- an epoch with tracking_mode 'sub_floor_tracking.v1' is activated (separate approval, docs/operations).
-- Tracking is a top-level field of the retained study result: it is never an event impact, candidate,
-- qualifying-day input, stability count or send. swell_watch_study_cycle_start is deliberately untouched, so a
-- tracking-only epoch continues the qualifying-day cycle. Rollback: docs/operations/swell-watch-study-sub-floor-tracking-rollback.sql.
-- Reviewed body hashes (pre -> post):
-- guard_swell_watch_study_authority 0746463f7308dc48acce42a70dfe3c01dc72e0ac97f6540e294d80dd16d808e8 -> fc2486d6e78c083df6f961bbd0a57e00ab41610fa1d5e34246be46809c48a891
-- read_swell_watch_study_health db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2 -> b48d69a9ffb135ce9116b519bc63daeed07e736b689d4cfead1460f7b4ad70f5
-- record_swell_watch_study_evaluation 9c0671783aa5ee045c89107c8910d6e0f649072cb932f5544e5196b7cdb2071c -> 99e5cbded55cd87b91f36bca9f3b007464f2cc0cb7f8b70fa51f646f47d60d4c
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';

DO $$ BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
END $$;

ALTER TABLE public.swell_watch_study_authorities
  ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'none'
  CHECK (tracking_mode IN ('none','sub_floor_tracking.v1'));

DO $amend$
DECLARE definition text; current_hash text;
BEGIN
  SELECT pg_get_functiondef('public.guard_swell_watch_study_authority()'::regprocedure) INTO definition;
  current_hash := encode(extensions.digest(definition,'sha256'),'hex');
  IF current_hash='fc2486d6e78c083df6f961bbd0a57e00ab41610fa1d5e34246be46809c48a891' THEN RETURN; END IF;
  IF current_hash<>'0746463f7308dc48acce42a70dfe3c01dc72e0ac97f6540e294d80dd16d808e8' THEN
    RAISE EXCEPTION 'guard_swell_watch_study_authority differs from reviewed baseline';
  END IF;
  definition := replace(definition,
    'ELSE jsonb_build_object(''qualificationRule'',NEW.qualification_rule) END)::text',
    'ELSE jsonb_build_object(''qualificationRule'',NEW.qualification_rule) END
      || CASE WHEN NEW.tracking_mode=''none'' THEN ''{}''::jsonb ELSE jsonb_build_object(''trackingMode'',NEW.tracking_mode) END)::text');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.guard_swell_watch_study_authority()'::regprocedure),'sha256'),'hex')<>'fc2486d6e78c083df6f961bbd0a57e00ab41610fa1d5e34246be46809c48a891' THEN
    RAISE EXCEPTION 'guard_swell_watch_study_authority definition hash mismatch';
  END IF;
END;
$amend$;

DO $amend$
DECLARE definition text; current_hash text;
BEGIN
  SELECT pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure) INTO definition;
  current_hash := encode(extensions.digest(definition,'sha256'),'hex');
  IF current_hash='b48d69a9ffb135ce9116b519bc63daeed07e736b689d4cfead1460f7b4ad70f5' THEN RETURN; END IF;
  IF current_hash<>'db17c16e2c3af8f092f34f8cb7feacd6f23e55984d96b7731ffaf16d2ab9d1b2' THEN
    RAISE EXCEPTION 'read_swell_watch_study_health differs from reviewed baseline';
  END IF;
  definition := replace(definition,
    '''policyHash'',a.policy_hash,''qualificationRule'',a.qualification_rule,',
    '''policyHash'',a.policy_hash,''qualificationRule'',a.qualification_rule,''trackingMode'',a.tracking_mode,');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.read_swell_watch_study_health()'::regprocedure),'sha256'),'hex')<>'b48d69a9ffb135ce9116b519bc63daeed07e736b689d4cfead1460f7b4ad70f5' THEN
    RAISE EXCEPTION 'read_swell_watch_study_health definition hash mismatch';
  END IF;
END;
$amend$;

DO $amend$
DECLARE definition text; current_hash text;
BEGIN
  SELECT pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure) INTO definition;
  current_hash := encode(extensions.digest(definition,'sha256'),'hex');
  IF current_hash='99e5cbded55cd87b91f36bca9f3b007464f2cc0cb7f8b70fa51f646f47d60d4c' THEN RETURN; END IF;
  IF current_hash<>'9c0671783aa5ee045c89107c8910d6e0f649072cb932f5544e5196b7cdb2071c' THEN
    RAISE EXCEPTION 'record_swell_watch_study_evaluation differs from reviewed baseline';
  END IF;
  -- Tracking rows ride beside the evaluation; they are bound to the authority and to derived scopes only.
  definition := replace(definition,
    '  digest := encode(extensions.digest(p_result::text,''sha256''),''hex'');',
    '  IF a.tracking_mode=''none'' THEN
    IF p_result ? ''trackingMode'' OR p_result ? ''trackingEvents'' THEN RAISE EXCEPTION ''study tracking requires a tracking authority''; END IF;
  ELSIF p_result->>''trackingMode'' IS DISTINCT FROM a.tracking_mode
    OR jsonb_typeof(p_result->''trackingEvents'') IS DISTINCT FROM ''array''
    OR jsonb_array_length(p_result->''trackingEvents'')>100
    OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->''trackingEvents'') t WHERE jsonb_typeof(t) IS DISTINCT FROM ''object''
      OR coalesce(t->>''phase'','''') NOT IN (''approaching'',''in_progress'')
      OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_result->''scopeOutcomes'') s
        WHERE s->>''sourcePointId''=t->>''sourcePointId'' AND s->>''status''=''derived'')) THEN
    RAISE EXCEPTION ''invalid study tracking events'';
  END IF;
  digest := encode(extensions.digest(p_result::text,''sha256''),''hex'');');
  EXECUTE definition;
  IF encode(extensions.digest(pg_get_functiondef('public.record_swell_watch_study_evaluation(uuid,text,jsonb,jsonb)'::regprocedure),'sha256'),'hex')<>'99e5cbded55cd87b91f36bca9f3b007464f2cc0cb7f8b70fa51f646f47d60d4c' THEN
    RAISE EXCEPTION 'record_swell_watch_study_evaluation definition hash mismatch';
  END IF;
END;
$amend$;

COMMIT;
