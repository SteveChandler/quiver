-- Session wave height provenance for forecast-validation truth.
--
-- sessions.wave_height_ft is the session "ground truth" for forecast accuracy
-- (session_wave_observation_candidates, the Phase 0 harness, Seaside reports). Since
-- 2026-06-20 the native session form fills an untouched wave height from the forecast
-- (PREFILL_FORECAST) and saves it if the surfer leaves it; the web form does the same.
-- Those rows compare the forecast with itself. On 2026-10-18, 56 of 95 instrumented
-- native submits were untouched prefills: 25% of the 222 usable truth candidates.
--
-- Provenance comes from the session_log_submit event both clients already emit
-- (forecast_prefilled / forecast_height_changed), so no installed binary needs to change:
--   * BEFORE INSERT on sessions reads the submit event. 92 of 98 events land before
--     the session row (native queues both and the event usually flushes first).
--   * AFTER INSERT on user_events labels a session row that landed first.
--   * A later change to wave_height_ft (the session-edit screen) makes it the surfer's.
-- NULL means unknown (rows before 2026-07-20, sessions without a submit event) and stays
-- in the truth set. Truth consumers exclude only 'forecast_prefill'.
--
-- Independent of the pending session-waves and Garmin migrations; apply on its own.
-- The transaction holds an ACCESS EXCLUSIVE lock on sessions and a SHARE ROW EXCLUSIVE
-- lock on user_events (new trigger) until COMMIT, so session saves and every analytics
-- insert wait for the backfill and re-sync (seconds). Apply off-peak.
-- Rollback: see the end of this file.

BEGIN;

ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS wave_height_source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_wave_height_source_check'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_wave_height_source_check
      CHECK (wave_height_source IN ('user', 'forecast_prefill')) NOT VALID;
  END IF;
END
$$;

ALTER TABLE public.sessions VALIDATE CONSTRAINT sessions_wave_height_source_check;

COMMENT ON COLUMN public.sessions.wave_height_source IS
  'Who set wave_height_ft: user (the surfer chose or changed it) or forecast_prefill (the form''s forecast estimate, saved untouched). NULL = unknown. Forecast-truth consumers must exclude forecast_prefill and keep NULL.';

-- Maps a session_log_submit metadata object to a provenance label. Compares jsonb
-- values instead of casting so a malformed flag yields NULL, never an error.
CREATE OR REPLACE FUNCTION public.session_wave_height_source_from_submit(p_metadata jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN jsonb_typeof(p_metadata) IS DISTINCT FROM 'object' THEN NULL
    WHEN p_metadata->'forecast_height_changed' = 'true'::jsonb THEN 'user'
    -- A prefill flag without a forecast means the height came from a deep link.
    WHEN p_metadata->'forecast_prefilled' = 'true'::jsonb
      AND p_metadata->'forecast_available' IS DISTINCT FROM 'false'::jsonb THEN 'forecast_prefill'
    WHEN p_metadata->'forecast_prefilled' IN ('true'::jsonb, 'false'::jsonb) THEN 'user'
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION public.apply_session_wave_height_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  submit_metadata jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- The snapshot trigger re-syncs truth after this, so an edited height counts again.
    IF OLD.wave_height_source = 'forecast_prefill'
      AND NEW.wave_height_source IS NOT DISTINCT FROM OLD.wave_height_source
      AND NEW.wave_height_ft IS DISTINCT FROM OLD.wave_height_ft
      AND NEW.wave_height_ft IS NOT NULL
    THEN
      NEW.wave_height_source := 'user';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.wave_height_source IS NOT NULL OR NEW.wave_height_ft IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT e.metadata
    INTO submit_metadata
    FROM public.user_events e
    WHERE e.user_id = NEW.user_id
      AND e.event_type = 'session_log_submit'
      AND (e.metadata->>'event_id') IS NOT NULL
      AND (e.metadata->>'event_id') <> ''
      AND (e.metadata->>'event_id') IN (
        'session:' || NEW.id::text || ':submit:v1',
        'session:' || NEW.id::text || ':submit:web:v1'
      )
    LIMIT 1;

    NEW.wave_height_source := public.session_wave_height_source_from_submit(submit_metadata);
  EXCEPTION WHEN OTHERS THEN
    -- Provenance must never block a session save.
    RAISE WARNING 'apply_session_wave_height_source skipped for session %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_session_wave_height_source ON public.sessions;
CREATE TRIGGER trigger_apply_session_wave_height_source
  BEFORE INSERT OR UPDATE OF wave_height_ft ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_session_wave_height_source();

CREATE OR REPLACE FUNCTION public.apply_submit_wave_height_source_to_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  derived_source text;
  labeled public.sessions%ROWTYPE;
BEGIN
  derived_source := public.session_wave_height_source_from_submit(NEW.metadata);
  IF derived_source IS NULL
    OR NEW.user_id IS NULL
    OR coalesce(NEW.metadata->>'session_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    RETURN NULL;
  END IF;

  BEGIN
    UPDATE public.sessions
    SET wave_height_source = derived_source
    WHERE id = (NEW.metadata->>'session_id')::uuid
      AND user_id = NEW.user_id
      AND wave_height_ft IS NOT NULL
      AND wave_height_source IS NULL
    RETURNING * INTO labeled;

    -- The snapshot trigger does not watch wave_height_source, so re-run the truth sync.
    IF labeled.id IS NOT NULL AND derived_source = 'forecast_prefill' THEN
      PERFORM public.sync_session_wave_observation_candidate(
        labeled.id,
        labeled.user_id,
        labeled.beach_id::uuid,
        labeled.arrival_time,
        labeled.status,
        labeled.wave_height_ft,
        'trigger'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- An analytics insert must never fail because of provenance.
    RAISE WARNING 'apply_submit_wave_height_source_to_session skipped for event %: %', NEW.id, SQLERRM;
  END;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trigger_apply_submit_wave_height_source ON public.user_events;
CREATE TRIGGER trigger_apply_submit_wave_height_source
  AFTER INSERT ON public.user_events
  FOR EACH ROW
  WHEN (NEW.event_type = 'session_log_submit')
  EXECUTE FUNCTION public.apply_submit_wave_height_source_to_session();

REVOKE ALL ON FUNCTION public.session_wave_height_source_from_submit(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_session_wave_height_source() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_submit_wave_height_source_to_session() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_session_wave_observation_candidate(
  p_session_id uuid,
  p_user_id uuid,
  p_beach_id uuid,
  p_arrival_time timestamptz,
  p_status text,
  p_wave_height_ft numeric,
  p_source_created_by text DEFAULT 'trigger'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  candidate_id uuid;
  observed_height_m numeric;
  rejection_reason_text text := NULL;
  nearest_prediction public.ml_predictions_log%rowtype;
  nearest_delta_minutes numeric;
  normalized_source_created_by text;
BEGIN
  IF p_session_id IS NULL THEN
    RETURN NULL;
  END IF;

  normalized_source_created_by := CASE
    WHEN p_source_created_by = 'backfill' THEN 'backfill'
    ELSE 'trigger'
  END;

  IF p_status IS DISTINCT FROM 'completed' THEN
    rejection_reason_text := 'session_not_completed';
  ELSIF p_beach_id IS NULL THEN
    rejection_reason_text := 'missing_beach_id';
  ELSIF p_arrival_time IS NULL THEN
    rejection_reason_text := 'missing_arrival_time';
  ELSIF p_wave_height_ft IS NULL THEN
    rejection_reason_text := 'missing_wave_height_ft';
  ELSIF p_wave_height_ft <= 0 OR p_wave_height_ft > 50 THEN
    rejection_reason_text := 'invalid_wave_height_ft';
  ELSIF EXISTS (
    SELECT 1
    FROM public.sessions s
    WHERE s.id = p_session_id
      AND s.wave_height_source = 'forecast_prefill'
  ) THEN
    -- The surfer accepted the form's forecast estimate without changing it, so
    -- the height is the forecast, not an observation of it.
    rejection_reason_text := 'forecast_prefilled_wave_height';
  END IF;

  IF rejection_reason_text IS NOT NULL THEN
    IF p_status IS DISTINCT FROM 'completed'
      AND NOT EXISTS (
        SELECT 1
        FROM public.session_wave_observation_candidates existing
        WHERE existing.session_id = p_session_id
      )
    THEN
      RETURN NULL;
    END IF;

    INSERT INTO public.session_wave_observation_candidates (
      session_id,
      user_id,
      beach_id,
      observed_at,
      reported_wave_height_ft,
      observed_m,
      ml_prediction_id,
      nearest_prediction_delta_minutes,
      quality_state,
      rejection_reason,
      observation_weight,
      source_created_by,
      matched_prediction_at,
      snapshot_display_height_m,
      snapshot_raw_om_height_m,
      snapshot_v5_shadow_height_m,
      snapshot_buoy_observed_m,
      snapshot_raw_forecast_m,
      snapshot_corrected_forecast_m,
      snapshot_model_version,
      snapshot_v5_model_version,
      snapshot_candidate_model_version,
      snapshot_display_source,
      forecast_horizon_hours
    ) VALUES (
      p_session_id,
      p_user_id,
      p_beach_id,
      p_arrival_time,
      p_wave_height_ft,
      NULL,
      NULL,
      NULL,
      'rejected',
      rejection_reason_text,
      0,
      normalized_source_created_by,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL
    )
    ON CONFLICT (session_id) DO UPDATE SET
      user_id = excluded.user_id,
      beach_id = excluded.beach_id,
      observed_at = excluded.observed_at,
      reported_wave_height_ft = excluded.reported_wave_height_ft,
      observed_m = NULL,
      ml_prediction_id = NULL,
      nearest_prediction_delta_minutes = NULL,
      quality_state = 'rejected',
      rejection_reason = excluded.rejection_reason,
      observation_weight = 0,
      matched_prediction_at = NULL,
      snapshot_display_height_m = NULL,
      snapshot_raw_om_height_m = NULL,
      snapshot_v5_shadow_height_m = NULL,
      snapshot_buoy_observed_m = NULL,
      snapshot_raw_forecast_m = NULL,
      snapshot_corrected_forecast_m = NULL,
      snapshot_model_version = NULL,
      snapshot_v5_model_version = NULL,
      snapshot_candidate_model_version = NULL,
      snapshot_display_source = NULL,
      forecast_horizon_hours = NULL,
      updated_at = now()
    RETURNING id INTO candidate_id;

    RETURN candidate_id;
  END IF;

  observed_height_m := round((p_wave_height_ft * 0.3048)::numeric, 3);

  SELECT p.*
  INTO nearest_prediction
  FROM public.ml_predictions_log p
  WHERE p.beach_id = p_beach_id
    AND p.display_source = 'face-Hs-transformer-v1'
    AND p.predicted_at IS NOT NULL
    AND p.predicted_at BETWEEN p_arrival_time - interval '6 hours'
                           AND p_arrival_time + interval '6 hours'
  ORDER BY
    abs(EXTRACT(EPOCH FROM (p.predicted_at - p_arrival_time))) ASC,
    CASE p.forecast_horizon_bucket
      WHEN '0-24h' THEN 1
      WHEN '25-72h' THEN 2
      WHEN '73h+' THEN 3
      ELSE 4
    END ASC,
    p.forecast_horizon_hours ASC NULLS LAST,
    p.created_at DESC
  LIMIT 1;

  IF nearest_prediction.id IS NOT NULL THEN
    nearest_delta_minutes :=
      round((abs(EXTRACT(EPOCH FROM (nearest_prediction.predicted_at - p_arrival_time))) / 60.0)::numeric, 1);
  END IF;

  INSERT INTO public.session_wave_observation_candidates (
    session_id,
    user_id,
    beach_id,
    ml_prediction_id,
    observed_at,
    reported_wave_height_ft,
    observed_m,
    nearest_prediction_delta_minutes,
    quality_state,
    rejection_reason,
    observation_weight,
    source_created_by,
    matched_prediction_at,
    snapshot_display_height_m,
    snapshot_raw_om_height_m,
    snapshot_v5_shadow_height_m,
    snapshot_buoy_observed_m,
    snapshot_raw_forecast_m,
    snapshot_corrected_forecast_m,
    snapshot_model_version,
    snapshot_v5_model_version,
    snapshot_candidate_model_version,
    snapshot_display_source,
    forecast_horizon_hours
  ) VALUES (
    p_session_id,
    p_user_id,
    p_beach_id,
    nearest_prediction.id,
    p_arrival_time,
    p_wave_height_ft,
    observed_height_m,
    nearest_delta_minutes,
    'weak',
    CASE WHEN nearest_prediction.id IS NULL THEN 'no_matching_prediction' ELSE NULL END,
    0.2,
    normalized_source_created_by,
    nearest_prediction.predicted_at,
    coalesce(nearest_prediction.offset_corrected_display_height_m, nearest_prediction.raw_display_height_m, nearest_prediction.corrected_forecast_m, nearest_prediction.raw_forecast_m, nearest_prediction.wave_height_om),
    nearest_prediction.wave_height_om,
    nearest_prediction.v5_shadow_height_m,
    nearest_prediction.observed_m,
    nearest_prediction.raw_forecast_m,
    nearest_prediction.corrected_forecast_m,
    nearest_prediction.model_version,
    nearest_prediction.v5_model_version,
    nearest_prediction.candidate_model_version,
    nearest_prediction.display_source,
    nearest_prediction.forecast_horizon_hours
  )
  ON CONFLICT (session_id) DO UPDATE SET
    user_id = excluded.user_id,
    beach_id = excluded.beach_id,
    ml_prediction_id = excluded.ml_prediction_id,
    observed_at = excluded.observed_at,
    reported_wave_height_ft = excluded.reported_wave_height_ft,
    observed_m = excluded.observed_m,
    nearest_prediction_delta_minutes = excluded.nearest_prediction_delta_minutes,
    quality_state = 'weak',
    rejection_reason = excluded.rejection_reason,
    observation_weight = 0.2,
    matched_prediction_at = excluded.matched_prediction_at,
    snapshot_display_height_m = excluded.snapshot_display_height_m,
    snapshot_raw_om_height_m = excluded.snapshot_raw_om_height_m,
    snapshot_v5_shadow_height_m = excluded.snapshot_v5_shadow_height_m,
    snapshot_buoy_observed_m = excluded.snapshot_buoy_observed_m,
    snapshot_raw_forecast_m = excluded.snapshot_raw_forecast_m,
    snapshot_corrected_forecast_m = excluded.snapshot_corrected_forecast_m,
    snapshot_model_version = excluded.snapshot_model_version,
    snapshot_v5_model_version = excluded.snapshot_v5_model_version,
    snapshot_candidate_model_version = excluded.snapshot_candidate_model_version,
    snapshot_display_source = excluded.snapshot_display_source,
    forecast_horizon_hours = excluded.forecast_horizon_hours,
    updated_at = now()
  RETURNING id INTO candidate_id;

  RETURN candidate_id;
END;
$$;

COMMENT ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) IS
  'Stores user-logged sessions.wave_height_ft as weak observation candidates matched to the nearest face-Hs display ml_predictions_log.predicted_at within +/- 6 hours. Phase 0 tie-breaks same-slot snapshots toward the shortest forecast horizon. Heights with sessions.wave_height_source = forecast_prefill are rejected as forecast_prefilled_wave_height. It snapshots model values for analytics and never updates ml_predictions_log.observed_m.';

REVOKE ALL ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_session_wave_observation_candidate(uuid, uuid, uuid, timestamptz, text, numeric, text) TO authenticated, service_role;


-- Backfill. user_events keeps ~90 days (the oldest submit expires 2026-10-20), so the
-- labels derived on 2026-10-18 are frozen here; events still present at apply time
-- take precedence and also cover sessions logged after the freeze.
WITH frozen(session_id, source) AS (
  SELECT unnest(ARRAY[
    'fe61665c-c28f-43ff-a582-c97c6256a415',
    '533389ec-cde9-40b9-8b66-7f36dd66cbd1',
    '017cf565-b78e-4061-83be-e3cfde8293ca',
    'f4fa769a-1dfa-4e07-821c-3cb11a1a0af2',
    '1a0e0f2c-067f-4cab-b346-534551e7c5ca',
    'af0bf394-cb37-4244-a9e3-2be92d7eeb96',
    '80e3e950-7287-4845-ae25-763b8693d67c',
    '489a0505-6b31-420d-88ed-5286186ccd31',
    'baabe5df-a982-4fad-a856-861fa792e4a9',
    '2d7df08a-5545-4a31-ab3b-46f946daae0e',
    'dc5ccbad-3f89-4640-9858-1aff935aae2f',
    '12d42260-677c-42a1-992d-1a746f48593c',
    '9d0a85f7-bd3c-467e-bd9d-7ae5838a2f3e',
    'cf90a73b-6713-4b83-9cc1-be81192334a0',
    'b858b981-a55a-460a-b40a-61131b28f1c6',
    '59a062cd-d334-4f50-9ea4-973949c37949',
    'ff392935-7819-4da8-ba40-07b3abd18eec',
    '37bebd21-4c14-4cb0-b3e5-8b8de4cab92e',
    '6e5c37e4-a036-4ac4-80b1-b0873057fb2a',
    '3af955a0-ecf1-4655-953a-f26b694c7428',
    '74244367-e386-44a2-8bc2-c8410768d5a9',
    '54119c22-7107-4666-85e4-8aa41adc4ef0',
    '94c2a9d7-a9e9-4f4f-91aa-408bbb34e4f4',
    '316ddba3-bcdb-435a-8b0c-4b0ee33eece3',
    '2fbfe50e-4644-4f47-8a03-590af4e8a834',
    'd782f0c4-9dac-47a3-9b6e-ee9653da6231',
    '4861ce98-b40c-46ab-8694-609d414a802e',
    '0a9c4687-35f5-429e-9d81-cf2e31c38448',
    'a6ea5f93-6362-4d48-bbde-d26ee57a48fa',
    'd6d824b0-cc96-43ee-9e2d-61ea1d96e439',
    '73b876b1-ca6a-4f87-a054-9faefe982a50',
    '87d85cf4-7cb0-4402-b5b7-3001904315df',
    '17d59732-53d2-4347-9ee2-495c3523adf4',
    'c05e3eb1-0486-4a26-9e5e-b362aaddd831',
    '0c048f4e-4039-4476-8da4-57395c77497e',
    '31edf073-1250-424e-b319-0da302668d7b',
    '7fc6e363-b3d3-4934-93db-d68532519f13',
    '82be15bd-6ae3-4593-911b-055b2d94c2f3',
    '01c87f13-b50b-4a12-9a91-fc96dc17e764',
    'dab5c873-6a7c-411f-8b51-5a12247b42aa',
    '3ffb840b-c329-429f-9f3c-35121c89cf27',
    '99a165fb-e27a-4a58-ae73-3b56ad667b4d',
    '69416a85-e701-4cf8-844f-9b160d196b83',
    '55bdaec0-f4c7-4d76-8dba-4474bece477b',
    'd185f1d1-f10e-468c-b25f-2717ad2315f8',
    'b2b60a50-ad8e-4821-9708-cf16834c8208',
    '19949472-62ae-4a8b-a483-0af438240e85',
    'cb1bfe43-3a73-4917-9dc3-58549283817a',
    'cd25a4ee-c037-40de-8606-02f210e71b10',
    'd249ab1b-99d5-4d9e-8083-40ebc9fabb46',
    '4b0666aa-8bb3-412f-a673-2eb103afe41a',
    '5aa52b9f-24f9-480e-ba71-10573d964624',
    '6a0392cb-862e-49ba-b25f-7d434731d120',
    '7ea46794-390c-4611-b08e-5d7f807a4050',
    'b6199707-2f20-4bcf-931c-97be6e5d7229',
    '091cb909-9125-45ea-840a-1fff8c904020'
  ]::uuid[]), 'forecast_prefill'
  UNION ALL
  SELECT unnest(ARRAY[
    '4246cb55-8c90-4135-a577-41bb5ab2899b',
    '2c36348b-49d1-44d4-985a-69abd5e0efcb',
    'a0cfe836-7e90-4351-bbe1-8e1c1599ab15',
    '420af1f1-a842-448c-8470-5da975a05017',
    '85eedf57-b83a-4b66-88c8-31da0c18b7c5',
    'ed465d66-1bd8-479d-8892-7b27a79d1f7a',
    'bc0c30f0-acd4-462d-8f99-ecf07d661dc9',
    'd6a3adcb-2f6e-48c8-8973-7d6bf6c35d82',
    '92382967-3554-4848-b595-9c003c9199f3',
    '212966f3-da1a-4999-8cbe-86041163e434',
    '353522bc-9d03-4bc2-bc43-cb1d9edd691e',
    '87c918dd-27b1-4a63-ae46-261c19b6cb9a',
    'abb0e379-d86e-4979-91ea-4022b604a3b1',
    'cb67cc17-2168-45b7-9cf6-429c1b9303d4',
    '2cfd7b07-9e54-4194-a933-9cbed3680391',
    '5f7187c6-478e-46b7-be55-54b050be1e19',
    '25b87206-ff48-4944-904f-e024d9c9928c',
    '86354c4d-c8d5-456e-b35d-608c8f810d1a',
    '76cca1be-48a3-4a89-951b-3173d90e6c4a',
    '19d9ee60-97d4-4396-bd34-ba5298d5cf11',
    '137a2dad-6ba7-4e57-bad9-ea26eb022afa',
    '002f2a30-d11d-4ce5-b8c9-84f232041056',
    '10e0240e-8ac9-45ce-8fdd-b626507cc85b',
    '1e428ece-f09f-4892-a7c3-6d72311b300a',
    '81622280-04a4-45dd-b095-70e8db7d558c',
    'f301257b-d203-44cf-aba7-5ff4d49c1528',
    '98390d25-fdd0-46c6-b992-8ae0a2d0d169',
    '1af7dda5-ef6c-4b33-b45b-4c1ac3a13d5c',
    '3c2d3d16-461a-4bdb-ac5c-f922eac2f76f',
    '77d0ad24-79d9-4592-a752-fde0bf92397f',
    '9a5f1846-3f9f-413e-ab97-e3ee65494f1d',
    '9cf1483f-4138-4a96-a9f0-867259d40951',
    'e9755c48-91de-4971-9b22-02c51d98f1fe',
    '19164402-9f1c-4b9c-bfd0-15d3709f6bdd',
    '49856d82-be36-41ef-bd98-9b1afd252171',
    '43d9c176-2f58-45b2-9587-328a0fca4158',
    'dbed4ccd-ff08-4107-89b9-ccefd8d38c68',
    'b8212d8f-30fd-4a82-b60a-81e5c6e87cc5',
    'd07cf1d7-1613-4223-9146-dc2b87819c20'
  ]::uuid[]), 'user'
),
from_events AS (
  SELECT DISTINCT ON (s.id)
    s.id AS session_id,
    public.session_wave_height_source_from_submit(e.metadata) AS source
  FROM public.user_events e
  JOIN public.sessions s
    ON s.id::text = e.metadata->>'session_id'
   AND s.user_id = e.user_id
  WHERE e.event_type = 'session_log_submit'
    AND public.session_wave_height_source_from_submit(e.metadata) IS NOT NULL
  ORDER BY s.id, e.created_at
),
labels AS (
  SELECT session_id, source FROM from_events
  UNION ALL
  SELECT f.session_id, f.source
  FROM frozen f
  WHERE NOT EXISTS (SELECT 1 FROM from_events fe WHERE fe.session_id = f.session_id)
)
UPDATE public.sessions s
SET wave_height_source = l.source
FROM labels l
WHERE s.id = l.session_id
  AND s.wave_height_ft IS NOT NULL
  AND s.wave_height_source IS NULL;

DO $$
DECLARE
  prefilled record;
BEGIN
  FOR prefilled IN
    SELECT id, user_id, beach_id, arrival_time, status, wave_height_ft
    FROM public.sessions
    WHERE wave_height_source = 'forecast_prefill'
  LOOP
    PERFORM public.sync_session_wave_observation_candidate(
      prefilled.id,
      prefilled.user_id,
      prefilled.beach_id::uuid,
      prefilled.arrival_time,
      prefilled.status,
      prefilled.wave_height_ft,
      'backfill'
    );
  END LOOP;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- Rollback (manual, after review):
-- BEGIN;
-- DROP TRIGGER IF EXISTS trigger_apply_submit_wave_height_source ON public.user_events;
-- DROP TRIGGER IF EXISTS trigger_apply_session_wave_height_source ON public.sessions;
-- DROP FUNCTION IF EXISTS public.apply_submit_wave_height_source_to_session();
-- DROP FUNCTION IF EXISTS public.apply_session_wave_height_source();
-- Re-run the sync_session_wave_observation_candidate definition from
-- 20260618160000_phase0_forecast_accuracy_metrics.sql, then re-sync the rows labeled
-- forecast_prefill before dropping the column:
-- ALTER TABLE public.sessions DROP COLUMN IF EXISTS wave_height_source;
-- DROP FUNCTION IF EXISTS public.session_wave_height_source_from_submit(jsonb);
-- COMMIT;
