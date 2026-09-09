BEGIN;

-- Keep observations from sessions, including explicit clearing, in every snapshot
-- writer. This copies reporting data; it does not certify historical independence.
CREATE OR REPLACE FUNCTION public.sync_session_wave_characteristics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  reported_tags text[];
BEGIN
  IF TG_RELID = 'public.sessions'::regclass THEN
    UPDATE public.session_forecast_snapshots
    SET actual_conditions = COALESCE(actual_conditions, '{}'::jsonb)
      || jsonb_build_object('wave_characteristics', NEW.wave_characteristics)
    WHERE session_id = NEW.id AND user_id = NEW.user_id
      AND beach_id IS NOT DISTINCT FROM NEW.beach_id;
    RETURN NEW;
  END IF;
  IF TG_RELID <> 'public.session_forecast_snapshots'::regclass THEN
    RAISE EXCEPTION 'Unexpected trigger relation' USING ERRCODE = '42501';
  END IF;

  SELECT s.wave_characteristics INTO reported_tags
  FROM public.sessions s
  WHERE s.id = NEW.session_id AND s.user_id = NEW.user_id
    AND s.beach_id IS NOT DISTINCT FROM NEW.beach_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Snapshot must match its session owner and beach' USING ERRCODE = '42501';
  END IF;
  NEW.actual_conditions := COALESCE(NEW.actual_conditions, '{}'::jsonb)
    || jsonb_build_object('wave_characteristics', reported_tags);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_session_wave_characteristics() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER preserve_snapshot_wave_characteristics
BEFORE INSERT OR UPDATE OF actual_conditions, session_id, user_id, beach_id ON public.session_forecast_snapshots
FOR EACH ROW EXECUTE FUNCTION public.sync_session_wave_characteristics();

CREATE TRIGGER sync_snapshot_wave_characteristics_on_session_edit
AFTER UPDATE OF wave_characteristics ON public.sessions
FOR EACH ROW
WHEN (OLD.wave_characteristics IS DISTINCT FROM NEW.wave_characteristics)
EXECUTE FUNCTION public.sync_session_wave_characteristics();

UPDATE public.session_forecast_snapshots sfs
SET actual_conditions = COALESCE(sfs.actual_conditions, '{}'::jsonb)
  || jsonb_build_object('wave_characteristics', s.wave_characteristics)
FROM public.sessions s
WHERE s.id = sfs.session_id AND s.user_id = sfs.user_id
  AND s.beach_id IS NOT DISTINCT FROM sfs.beach_id
  AND (sfs.actual_conditions -> 'wave_characteristics')
    IS DISTINCT FROM COALESCE(to_jsonb(s.wave_characteristics), 'null'::jsonb);

-- Rollback: drop the two triggers, then this function. The additive JSON key
-- can remain; removing it would discard observations. Forecast inputs untouched.
COMMIT;
