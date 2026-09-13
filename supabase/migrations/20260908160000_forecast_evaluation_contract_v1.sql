-- Forecast evaluation v1. Additive provenance; no historical rewrite/backfill.
-- Apply before deploying the Seaside RPC client. Rollback: see
-- docs/forecast/FORECAST_EVALUATION_V1.md. No cron registration/flags change here.
BEGIN;

ALTER TABLE public.ml_predictions_log ADD COLUMN IF NOT EXISTS observation_match jsonb;
ALTER TABLE public.ioos_observations ADD COLUMN IF NOT EXISTS evaluation_revision integer;
ALTER TABLE public.ioos_observations ADD COLUMN IF NOT EXISTS evaluation_revised_at timestamptz;
ALTER TABLE public.ndbc_direct_observations ADD COLUMN IF NOT EXISTS evaluation_revision integer;
ALTER TABLE public.ndbc_direct_observations ADD COLUMN IF NOT EXISTS evaluation_revised_at timestamptz;

CREATE OR REPLACE FUNCTION public.record_wave_observation_revision_v1()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.evaluation_revision := 1;
    NEW.evaluation_revised_at := clock_timestamp();
    NEW.created_at := NEW.evaluation_revised_at;
  ELSIF ROW(NEW.wave_height_m, NEW.observed_at, NEW.station_id)
      IS DISTINCT FROM ROW(OLD.wave_height_m, OLD.observed_at, OLD.station_id) THEN
    NEW.evaluation_revision := coalesce(OLD.evaluation_revision, 0) + 1;
    NEW.evaluation_revised_at := clock_timestamp();
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.evaluation_revision := OLD.evaluation_revision;
    NEW.evaluation_revised_at := OLD.evaluation_revised_at;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER record_ioos_evaluation_revision_v1
BEFORE INSERT OR UPDATE ON public.ioos_observations
FOR EACH ROW EXECUTE FUNCTION public.record_wave_observation_revision_v1();
CREATE TRIGGER record_ndbc_evaluation_revision_v1
BEFORE INSERT OR UPDATE ON public.ndbc_direct_observations
FOR EACH ROW EXECUTE FUNCTION public.record_wave_observation_revision_v1();

-- Keep the existing unified view's public shape and IOOS/NDBC deduplication.
CREATE VIEW public.evaluation_wave_observations_v1 WITH (security_invoker = true) AS
SELECT u.*, o.id::text AS observation_id, o.created_at AS ingested_at,
       o.evaluation_revised_at AS available_at, o.evaluation_revision AS revision
FROM public.unified_wave_observations u
JOIN public.ioos_observations o USING (station_id, observed_at)
WHERE u.source = 'ioos'
UNION ALL
SELECT u.*, o.id::text, o.created_at, o.evaluation_revised_at, o.evaluation_revision
FROM public.unified_wave_observations u
JOIN public.ndbc_direct_observations o USING (station_id, observed_at)
WHERE u.source = 'ndbc_direct';
REVOKE ALL ON public.evaluation_wave_observations_v1 FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.evaluation_wave_observations_v1 TO service_role;

-- Preserve the current resolver tiers/radius; make equal station choices stable.
CREATE OR REPLACE FUNCTION public.get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  -- Tier 0: explicit CDIP station override with recent usable wave observations.
  WITH preferred_cdip_station AS (
    SELECT
      'edu_ucsd_cdip_' || lpad(
        nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), ''),
        3,
        '0'
      ) AS station_id
    FROM public.beaches b
    WHERE b.id = p_beach_id
      AND b.cdip_station IS NOT NULL
      AND nullif(regexp_replace(b.cdip_station, '\D', '', 'g'), '') IS NOT NULL
  )
  SELECT preferred_cdip_station.station_id INTO v_station_id
  FROM preferred_cdip_station
  WHERE EXISTS (
    SELECT 1
    FROM public.unified_wave_observations o
    WHERE o.station_id = preferred_cdip_station.station_id
      AND o.observed_at >= now() - interval '7 days'
      AND o.wave_height_m IS NOT NULL
      AND o.wave_height_m > 0
  )
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 1: IOOS station whose nearest_beach_id matches directly.
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
  ORDER BY s.station_id COLLATE "C"
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 2: IOOS station within 25km with compatible swell (>= 30°).
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography), s.station_id COLLATE "C"
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 3: NDBC direct station whose nearest_beach_id matches.
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
  ORDER BY s.distance_to_beach_km, s.station_id COLLATE "C"
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  -- Tier 4: NDBC direct station within 25km with compatible swell (>= 30°).
  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND ST_DWithin(b.geog, s.coordinates::geography, 25000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
  ORDER BY ST_Distance(b.geog, s.coordinates::geography), s.station_id COLLATE "C"
  LIMIT 1;

  RETURN v_station_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;


-- Direct mapping first, resolved station fallback second (existing Python policy).
-- Nearest time in the winning tier; earlier event on equal distance, then IOOS,
-- station id and observation id. ±12h operational coverage is unchanged.
CREATE FUNCTION public.select_wave_observation_v1(
  p_beach_id uuid, p_valid_at timestamptz, p_as_of timestamptz
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE
  chosen public.evaluation_wave_observations_v1%ROWTYPE;
  station text;
  tier text := 'direct';
BEGIN
  IF p_valid_at IS NULL OR p_as_of IS NULL THEN
    RAISE EXCEPTION 'valid time and as-of time are required';
  END IF;
  SELECT o.* INTO chosen FROM public.evaluation_wave_observations_v1 o
  WHERE o.nearest_beach_id = p_beach_id
    AND o.wave_height_m > 0 AND o.wave_height_m <= 30
    AND o.observed_at BETWEEN p_valid_at - interval '12 hours' AND p_valid_at + interval '12 hours'
    AND o.observed_at <= p_as_of
    AND coalesce(o.available_at, o.ingested_at) <= p_as_of
  ORDER BY abs(extract(epoch FROM o.observed_at - p_valid_at)), o.observed_at,
    CASE o.source WHEN 'ioos' THEN 0 ELSE 1 END, o.station_id COLLATE "C", o.observation_id COLLATE "C"
  LIMIT 1;
  IF NOT FOUND THEN
    tier := 'resolved_station';
    station := public.get_beach_observation_station(p_beach_id);
    SELECT o.* INTO chosen FROM public.evaluation_wave_observations_v1 o
    WHERE o.station_id = station
      AND o.wave_height_m > 0 AND o.wave_height_m <= 30
      AND o.observed_at BETWEEN p_valid_at - interval '12 hours' AND p_valid_at + interval '12 hours'
      AND o.observed_at <= p_as_of
      AND coalesce(o.available_at, o.ingested_at) <= p_as_of
    ORDER BY abs(extract(epoch FROM o.observed_at - p_valid_at)), o.observed_at,
      CASE o.source WHEN 'ioos' THEN 0 ELSE 1 END, o.station_id COLLATE "C", o.observation_id COLLATE "C"
    LIMIT 1;
  END IF;
  IF chosen.observation_id IS NULL THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'policy_version', 'wave-match/v1', 'target', 'offshore_hs', 'unit', 'm',
    'value', chosen.wave_height_m, 'observation_id', chosen.observation_id,
    'station_id', chosen.station_id, 'source', chosen.source, 'station_tier', tier,
    'source_network', chosen.source_network,
    'event_at', chosen.observed_at, 'ingested_at', chosen.ingested_at,
    'available_at', chosen.available_at, 'revision', chosen.revision,
    'matched_at', p_as_of, 'valid_at', p_valid_at,
    'delta_seconds', abs(extract(epoch FROM chosen.observed_at - p_valid_at)),
    'quality', 'range_checked', 'qualification', NULL,
    'strict_time_eligible', abs(extract(epoch FROM chosen.observed_at - p_valid_at)) <= 3600,
    'strict_eligible', false, 'exclusion_reason', 'unqualified_label'
  );
END;
$$;

-- Atomic first label write; all prediction values and prior labels stay frozen.
-- Missing labels remain retryable for the seven-day processing window. Existing
-- historical -1 sentinels are preserved, never silently reopened.
CREATE FUNCTION public.match_ml_observation_v1(
  p_prediction_id uuid, p_as_of timestamptz DEFAULT clock_timestamp()
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prediction public.ml_predictions_log%ROWTYPE;
  matched_label jsonb;
  height numeric;
BEGIN
  SELECT * INTO prediction FROM public.ml_predictions_log WHERE id = p_prediction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'prediction not found'; END IF;
  IF prediction.observed_m IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already_matched');
  END IF;
  matched_label := public.select_wave_observation_v1(prediction.beach_id, prediction.predicted_at, p_as_of);
  IF matched_label IS NULL THEN
    UPDATE public.ml_predictions_log SET observation_match = jsonb_build_object(
      'policy_version', 'wave-match/v1', 'matched_at', p_as_of,
      'strict_eligible', false, 'exclusion_reason', 'missing_label'
    ) WHERE id = p_prediction_id;
    RETURN jsonb_build_object('status', 'no_match');
  END IF;
  height := (matched_label->>'value')::numeric;
  UPDATE public.ml_predictions_log SET observed_m = height,
    raw_error_m = abs(raw_forecast_m - height),
    corrected_error_m = abs(corrected_forecast_m - height),
    observation_match = matched_label
  WHERE id = p_prediction_id;
  RETURN jsonb_build_object('status', 'matched', 'match', matched_label);
END;
$$;

-- The backup and Python worker now call exactly the same selector/updater.
CREATE OR REPLACE FUNCTION public.backfill_ml_observations_batch(batch_size integer DEFAULT 10000)
RETURNS TABLE(processed integer, matched integer, sentinel_marked integer, expired_deleted integer, elapsed_ms numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  started timestamptz := clock_timestamp();
  prediction_id uuid;
  result jsonb;
BEGIN
  processed := 0; matched := 0; sentinel_marked := 0; expired_deleted := 0;
  IF batch_size IS NULL OR batch_size < 1 OR batch_size > 10000 THEN
    RAISE EXCEPTION 'invalid batch size';
  END IF;
  FOR prediction_id IN
    SELECT p.id FROM public.ml_predictions_log p
    WHERE p.observed_m IS NULL AND p.predicted_at < started - interval '2 hours'
      AND p.predicted_at > started - interval '7 days'
    ORDER BY p.observation_match->>'matched_at' NULLS FIRST, p.predicted_at, p.id LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  LOOP
    result := public.match_ml_observation_v1(prediction_id, started);
    processed := processed + 1;
    IF result->>'status' = 'matched' THEN matched := matched + 1; END IF;
  END LOOP;
  elapsed_ms := round(extract(epoch FROM clock_timestamp() - started) * 1000, 2);
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.select_wave_observation_v1(uuid,timestamptz,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.match_ml_observation_v1(uuid,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.backfill_ml_observations_batch(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.select_wave_observation_v1(uuid,timestamptz,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_ml_observation_v1(uuid,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.backfill_ml_observations_batch(integer) TO service_role;
COMMENT ON COLUMN public.ml_predictions_log.observation_match IS
  'Frozen outcome snapshot under wave-match/v1. Operational buoy matching is not strict face-height truth. Legacy NULL provenance is ineligible.';
COMMIT;
