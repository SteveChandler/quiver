-- Reapply the finalized custom-spot fingerprint contract because the original
-- migration version was recorded remotely before its review fixes landed.
BEGIN;

-- Custom-spot forecasts continue to borrow observations and tide stations from
-- nearest_beach_id. These columns hold only the local geometric transformation
-- and optional reviewed preferences for the custom coordinate.
ALTER TABLE public.custom_spots
  ADD COLUMN IF NOT EXISTS swell_access_factors real[72],
  ADD COLUMN IF NOT EXISTS wind_exposure_factors real[72],
  ADD COLUMN IF NOT EXISTS terrain_method text,
  ADD COLUMN IF NOT EXISTS terrain_params jsonb,
  ADD COLUMN IF NOT EXISTS terrain_params_hash text,
  ADD COLUMN IF NOT EXISTS terrain_analyzed_at timestamptz,
  ADD COLUMN IF NOT EXISTS terrain_status text,
  ADD COLUMN IF NOT EXISTS terrain_analysis_debug jsonb,
  ADD COLUMN IF NOT EXISTS preferred_tide_ft_min numeric,
  ADD COLUMN IF NOT EXISTS preferred_tide_ft_max numeric,
  ADD COLUMN IF NOT EXISTS preferred_tide_direction text,
  ADD COLUMN IF NOT EXISTS tide_direction_sensitivity text,
  ADD COLUMN IF NOT EXISTS skill_level text,
  ADD COLUMN IF NOT EXISTS fingerprint_provenance_state text NOT NULL DEFAULT 'unset',
  ADD COLUMN IF NOT EXISTS fingerprint_model_version text,
  ADD COLUMN IF NOT EXISTS fingerprint_coordinate_hash text,
  ADD COLUMN IF NOT EXISTS fingerprint_provenance jsonb NOT NULL DEFAULT '{"schema_version":1,"fields":{}}'::jsonb,
  ADD COLUMN IF NOT EXISTS analysis_requested_at timestamptz;

CREATE OR REPLACE FUNCTION public.is_valid_directional_factor_array(p_values real[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT p_values IS NULL OR (
    array_length(p_values, 1) = 72
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(p_values) AS value
      WHERE value IS NULL OR value < 0 OR value > 1 OR value::text IN ('NaN', 'Infinity', '-Infinity')
    )
  );
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_swell_access_factors_valid'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_swell_access_factors_valid
      CHECK (public.is_valid_directional_factor_array(swell_access_factors));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_wind_exposure_factors_valid'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_wind_exposure_factors_valid
      CHECK (public.is_valid_directional_factor_array(wind_exposure_factors));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_terrain_status_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_terrain_status_check
      CHECK (terrain_status IS NULL OR terrain_status IN ('queued', 'processing', 'ok', 'wind_only', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_fingerprint_provenance_state_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_fingerprint_provenance_state_check
      CHECK (fingerprint_provenance_state IN ('unset', 'modeled', 'independently_reviewed', 'user_corrected', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_tide_height_range_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_tide_height_range_check
      CHECK (
        preferred_tide_ft_min IS NULL
        OR preferred_tide_ft_max IS NULL
        OR preferred_tide_ft_min <= preferred_tide_ft_max
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_preferred_tide_direction_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_preferred_tide_direction_check
      CHECK (preferred_tide_direction IS NULL OR preferred_tide_direction IN ('rising', 'falling', 'either', 'slack'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_tide_direction_sensitivity_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_tide_direction_sensitivity_check
      CHECK (tide_direction_sensitivity IS NULL OR tide_direction_sensitivity IN ('low', 'medium', 'high'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'custom_spots_skill_level_check'
      AND conrelid = 'public.custom_spots'::regclass
  ) THEN
    ALTER TABLE public.custom_spots
      ADD CONSTRAINT custom_spots_skill_level_check
      CHECK (skill_level IS NULL OR skill_level IN ('beginner', 'intermediate', 'advanced', 'expert'));
  END IF;
END $$;

COMMENT ON COLUMN public.custom_spots.swell_access_factors IS
  'Coordinate-derived local swell access in 72 five-degree bins. Forecast observations remain anchored to nearest_beach_id.';
COMMENT ON COLUMN public.custom_spots.wind_exposure_factors IS
  'Coordinate-derived local wind exposure in 72 five-degree bins.';
COMMENT ON COLUMN public.custom_spots.fingerprint_provenance_state IS
  'Compact state: unset, modeled, independently_reviewed, user_corrected, or failed.';
COMMENT ON COLUMN public.custom_spots.fingerprint_provenance IS
  'Field-level provenance and model metadata. Must not contain the private spot name or precise coordinate.';
COMMENT ON COLUMN public.custom_spots.terrain_analysis_debug IS
  'Privacy-safe terrain diagnostics. Must not contain the custom spot name or precise coordinate.';

CREATE TABLE IF NOT EXISTS public.custom_spot_analysis_jobs (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  custom_spot_id uuid NOT NULL UNIQUE REFERENCES public.custom_spots(id) ON DELETE CASCADE,
  requested_model_version text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'retry', 'complete', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  last_error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custom_spot_analysis_jobs_ready_idx
  ON public.custom_spot_analysis_jobs (next_attempt_at, id)
  WHERE status IN ('queued', 'retry');

ALTER TABLE public.custom_spot_analysis_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.custom_spot_analysis_jobs FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.custom_spot_analysis_jobs TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.custom_spot_analysis_jobs_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.queue_custom_spot_analysis()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  model_version constant text := 'custom_spot_terrain_v1';
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.lat IS NOT DISTINCT FROM OLD.lat
     AND NEW.lon IS NOT DISTINCT FROM OLD.lon
     AND NEW.break_type IS NOT DISTINCT FROM OLD.break_type THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.custom_spot_analysis_jobs (
    custom_spot_id,
    requested_model_version,
    status,
    attempts,
    next_attempt_at,
    locked_at,
    last_error_code,
    updated_at
  ) VALUES (
    NEW.id,
    model_version,
    'queued',
    0,
    now(),
    NULL,
    NULL,
    now()
  )
  ON CONFLICT (custom_spot_id) DO UPDATE SET
    requested_model_version = EXCLUDED.requested_model_version,
    status = 'queued',
    attempts = 0,
    next_attempt_at = now(),
    locked_at = NULL,
    last_error_code = NULL,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prepare_custom_spot_analysis_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  coordinate_changed boolean := TG_OP = 'INSERT';
  fields jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    coordinate_changed := NEW.lat IS DISTINCT FROM OLD.lat
      OR NEW.lon IS DISTINCT FROM OLD.lon
      OR NEW.break_type IS DISTINCT FROM OLD.break_type;

    IF auth.uid() IS NOT NULL THEN
      fields := COALESCE(OLD.fingerprint_provenance->'fields', '{}'::jsonb);
      NEW.swell_access_factors := OLD.swell_access_factors;
      NEW.wind_exposure_factors := OLD.wind_exposure_factors;
      NEW.terrain_method := OLD.terrain_method;
      NEW.terrain_params := OLD.terrain_params;
      NEW.terrain_params_hash := OLD.terrain_params_hash;
      NEW.terrain_analyzed_at := OLD.terrain_analyzed_at;
      NEW.terrain_status := OLD.terrain_status;
      NEW.terrain_analysis_debug := OLD.terrain_analysis_debug;
      NEW.fingerprint_provenance_state := OLD.fingerprint_provenance_state;
      NEW.fingerprint_model_version := OLD.fingerprint_model_version;
      NEW.fingerprint_coordinate_hash := OLD.fingerprint_coordinate_hash;
      NEW.fingerprint_provenance := OLD.fingerprint_provenance;
      NEW.fingerprint_confidence := OLD.fingerprint_confidence;
      NEW.fingerprint_updated_at := OLD.fingerprint_updated_at;
      NEW.analysis_requested_at := OLD.analysis_requested_at;

      IF NEW.facing_direction_deg IS DISTINCT FROM OLD.facing_direction_deg THEN
        fields := CASE WHEN NEW.facing_direction_deg IS NULL THEN fields #- '{facing_direction_deg}'
          ELSE jsonb_set(fields, '{facing_direction_deg}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.swell_window_min_deg IS DISTINCT FROM OLD.swell_window_min_deg THEN
        fields := CASE WHEN NEW.swell_window_min_deg IS NULL THEN fields #- '{swell_window_min_deg}'
          ELSE jsonb_set(fields, '{swell_window_min_deg}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.swell_window_max_deg IS DISTINCT FROM OLD.swell_window_max_deg THEN
        fields := CASE WHEN NEW.swell_window_max_deg IS NULL THEN fields #- '{swell_window_max_deg}'
          ELSE jsonb_set(fields, '{swell_window_max_deg}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.offshore_direction_deg IS DISTINCT FROM OLD.offshore_direction_deg THEN
        fields := CASE WHEN NEW.offshore_direction_deg IS NULL THEN fields #- '{offshore_direction_deg}'
          ELSE jsonb_set(fields, '{offshore_direction_deg}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.exposure_level IS DISTINCT FROM OLD.exposure_level THEN
        fields := CASE WHEN NEW.exposure_level IS NULL THEN fields #- '{exposure_level}'
          ELSE jsonb_set(fields, '{exposure_level}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.preferred_tide_ft_min IS DISTINCT FROM OLD.preferred_tide_ft_min THEN
        fields := CASE WHEN NEW.preferred_tide_ft_min IS NULL THEN fields #- '{preferred_tide_ft_min}'
          ELSE jsonb_set(fields, '{preferred_tide_ft_min}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.preferred_tide_ft_max IS DISTINCT FROM OLD.preferred_tide_ft_max THEN
        fields := CASE WHEN NEW.preferred_tide_ft_max IS NULL THEN fields #- '{preferred_tide_ft_max}'
          ELSE jsonb_set(fields, '{preferred_tide_ft_max}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.preferred_tide_direction IS DISTINCT FROM OLD.preferred_tide_direction THEN
        fields := CASE WHEN NEW.preferred_tide_direction IS NULL THEN fields #- '{preferred_tide_direction}'
          ELSE jsonb_set(fields, '{preferred_tide_direction}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.tide_direction_sensitivity IS DISTINCT FROM OLD.tide_direction_sensitivity THEN
        fields := CASE WHEN NEW.tide_direction_sensitivity IS NULL THEN fields #- '{tide_direction_sensitivity}'
          ELSE jsonb_set(fields, '{tide_direction_sensitivity}', '"user_corrected"'::jsonb, true) END;
      END IF;
      IF NEW.skill_level IS DISTINCT FROM OLD.skill_level THEN
        fields := CASE WHEN NEW.skill_level IS NULL THEN fields #- '{skill_level}'
          ELSE jsonb_set(fields, '{skill_level}', '"user_corrected"'::jsonb, true) END;
      END IF;

      IF fields <> COALESCE(OLD.fingerprint_provenance->'fields', '{}'::jsonb) THEN
        IF NEW.facing_direction_deg IS NULL
          AND NEW.swell_window_min_deg IS NULL
          AND NEW.swell_window_max_deg IS NULL
          AND NEW.offshore_direction_deg IS NULL
          AND NEW.exposure_level IS NULL
          AND NEW.preferred_tide_ft_min IS NULL
          AND NEW.preferred_tide_ft_max IS NULL
          AND NEW.preferred_tide_direction IS NULL
          AND NEW.tide_direction_sensitivity IS NULL
          AND NEW.skill_level IS NULL THEN
          IF OLD.terrain_status = 'ok'
            AND OLD.fingerprint_model_version = 'custom_spot_terrain_v1'
            AND public.is_valid_directional_factor_array(OLD.swell_access_factors)
            AND OLD.swell_access_factors IS NOT NULL
            AND public.is_valid_directional_factor_array(OLD.wind_exposure_factors)
            AND OLD.wind_exposure_factors IS NOT NULL THEN
            NEW.fingerprint_provenance_state := 'modeled';
            NEW.fingerprint_confidence := 'modeled';
          ELSE
            NEW.fingerprint_provenance_state := 'unset';
            NEW.fingerprint_confidence := 'unset';
          END IF;
        ELSE
          NEW.fingerprint_provenance_state := 'user_corrected';
          NEW.fingerprint_confidence := 'user_set';
        END IF;
        NEW.fingerprint_provenance := jsonb_set(
          COALESCE(OLD.fingerprint_provenance, '{"schema_version":1}'::jsonb),
          '{fields}', fields, true
        );
        NEW.fingerprint_updated_at := now();
      END IF;
    ELSE
      fields := COALESCE(NEW.fingerprint_provenance->'fields', '{}'::jsonb);
    END IF;
  ELSIF auth.uid() IS NOT NULL THEN
    NEW.swell_access_factors := NULL;
    NEW.wind_exposure_factors := NULL;
    NEW.terrain_method := NULL;
    NEW.terrain_params := NULL;
    NEW.terrain_params_hash := NULL;
    NEW.terrain_analyzed_at := NULL;
    NEW.terrain_status := NULL;
    NEW.terrain_analysis_debug := NULL;
    NEW.fingerprint_provenance_state := 'unset';
    NEW.fingerprint_model_version := NULL;
    NEW.fingerprint_coordinate_hash := NULL;
    NEW.fingerprint_provenance := '{"schema_version":1,"fields":{}}'::jsonb;
    NEW.analysis_requested_at := NULL;
    IF NEW.fingerprint_confidence IS DISTINCT FROM 'user_set' THEN
      NEW.fingerprint_confidence := 'unset';
      NEW.fingerprint_updated_at := NULL;
    END IF;

    IF NEW.fingerprint_confidence = 'user_set' THEN
      IF NEW.facing_direction_deg IS NOT NULL THEN
        fields := jsonb_set(fields, '{facing_direction_deg}', '"user_corrected"'::jsonb, true);
      END IF;
      IF NEW.swell_window_min_deg IS NOT NULL THEN
        fields := jsonb_set(fields, '{swell_window_min_deg}', '"user_corrected"'::jsonb, true);
      END IF;
      IF NEW.swell_window_max_deg IS NOT NULL THEN
        fields := jsonb_set(fields, '{swell_window_max_deg}', '"user_corrected"'::jsonb, true);
      END IF;
      IF NEW.offshore_direction_deg IS NOT NULL THEN
        fields := jsonb_set(fields, '{offshore_direction_deg}', '"user_corrected"'::jsonb, true);
      END IF;
      IF NEW.exposure_level IS NOT NULL THEN
        fields := jsonb_set(fields, '{exposure_level}', '"user_corrected"'::jsonb, true);
      END IF;
      NEW.fingerprint_provenance_state := 'user_corrected';
    END IF;

    IF NEW.preferred_tide_ft_min IS NOT NULL THEN
      fields := jsonb_set(fields, '{preferred_tide_ft_min}', '"user_corrected"'::jsonb, true);
    END IF;
    IF NEW.preferred_tide_ft_max IS NOT NULL THEN
      fields := jsonb_set(fields, '{preferred_tide_ft_max}', '"user_corrected"'::jsonb, true);
    END IF;
    IF NEW.preferred_tide_direction IS NOT NULL THEN
      fields := jsonb_set(fields, '{preferred_tide_direction}', '"user_corrected"'::jsonb, true);
    END IF;
    IF NEW.tide_direction_sensitivity IS NOT NULL THEN
      fields := jsonb_set(fields, '{tide_direction_sensitivity}', '"user_corrected"'::jsonb, true);
    END IF;
    IF NEW.skill_level IS NOT NULL THEN
      fields := jsonb_set(fields, '{skill_level}', '"user_corrected"'::jsonb, true);
    END IF;
    IF fields <> '{}'::jsonb THEN
      NEW.fingerprint_provenance_state := 'user_corrected';
      NEW.fingerprint_confidence := 'user_set';
      NEW.fingerprint_updated_at := now();
    END IF;
  ELSE
    fields := COALESCE(NEW.fingerprint_provenance->'fields', '{}'::jsonb);
  END IF;

  NEW.fingerprint_provenance := jsonb_set(
    COALESCE(NEW.fingerprint_provenance, '{"schema_version":1}'::jsonb),
    '{fields}',
    fields,
    true
  );

  IF coordinate_changed AND NEW.deleted_at IS NULL THEN
    NEW.terrain_status := 'queued';
    NEW.analysis_requested_at := now();
    NEW.terrain_analyzed_at := NULL;
    NEW.terrain_method := NULL;
    NEW.terrain_params := NULL;
    NEW.terrain_params_hash := NULL;
    NEW.terrain_analysis_debug := NULL;
    NEW.fingerprint_model_version := NULL;
    NEW.fingerprint_coordinate_hash := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS custom_spots_prepare_analysis_state ON public.custom_spots;
CREATE TRIGGER custom_spots_prepare_analysis_state
  BEFORE INSERT OR UPDATE
  ON public.custom_spots
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_custom_spot_analysis_state();

DROP TRIGGER IF EXISTS custom_spots_queue_analysis ON public.custom_spots;
CREATE TRIGGER custom_spots_queue_analysis
  AFTER INSERT OR UPDATE OF lat, lon, break_type
  ON public.custom_spots
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_custom_spot_analysis();

CREATE OR REPLACE FUNCTION public.claim_custom_spot_analysis_jobs(p_batch_size integer DEFAULT 5)
RETURNS TABLE (
  job_id bigint,
  custom_spot_id uuid,
  requested_model_version text,
  attempts integer,
  claimed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_batch_size < 1 OR p_batch_size > 25 THEN
    RAISE EXCEPTION 'invalid_custom_spot_analysis_batch_size';
  END IF;

  RETURN QUERY
  WITH claimed AS (
    SELECT jobs.id
    FROM public.custom_spot_analysis_jobs AS jobs
    JOIN public.custom_spots AS spots ON spots.id = jobs.custom_spot_id
    WHERE (
        (jobs.status IN ('queued', 'retry') AND jobs.next_attempt_at <= now())
        OR (jobs.status = 'processing' AND jobs.locked_at < now() - interval '15 minutes')
      )
      AND spots.deleted_at IS NULL
    ORDER BY jobs.next_attempt_at, jobs.id
    FOR UPDATE OF jobs SKIP LOCKED
    LIMIT p_batch_size
  )
  UPDATE public.custom_spot_analysis_jobs AS jobs
  SET
    status = 'processing',
    attempts = jobs.attempts + 1,
    locked_at = now(),
    updated_at = now()
  FROM claimed
  WHERE jobs.id = claimed.id
  RETURNING
    jobs.id,
    jobs.custom_spot_id,
    jobs.requested_model_version,
    jobs.attempts,
    jobs.locked_at;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_custom_spot_analysis_jobs(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_custom_spot_analysis_jobs(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_custom_spot_analysis_job(
  p_job_id bigint,
  p_claimed_at timestamptz,
  p_spot_updated_at timestamptz,
  p_update jsonb
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_spot_id uuid;
BEGIN
  SELECT custom_spot_id INTO target_spot_id
  FROM public.custom_spot_analysis_jobs
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_at = p_claimed_at
  FOR UPDATE;

  IF target_spot_id IS NULL THEN RETURN false; END IF;

  UPDATE public.custom_spots
  SET
    facing_direction_deg = CASE WHEN p_update ? 'facing_direction_deg' THEN (p_update->>'facing_direction_deg')::numeric ELSE facing_direction_deg END,
    offshore_direction_deg = CASE WHEN p_update ? 'offshore_direction_deg' THEN (p_update->>'offshore_direction_deg')::numeric ELSE offshore_direction_deg END,
    swell_window_min_deg = CASE WHEN p_update ? 'swell_window_min_deg' THEN (p_update->>'swell_window_min_deg')::numeric ELSE swell_window_min_deg END,
    swell_window_max_deg = CASE WHEN p_update ? 'swell_window_max_deg' THEN (p_update->>'swell_window_max_deg')::numeric ELSE swell_window_max_deg END,
    exposure_level = CASE WHEN p_update ? 'exposure_level' THEN p_update->>'exposure_level' ELSE exposure_level END,
    swell_access_factors = CASE WHEN p_update ? 'swell_access_factors' THEN ARRAY(SELECT jsonb_array_elements_text(p_update->'swell_access_factors'))::real[] ELSE swell_access_factors END,
    wind_exposure_factors = CASE WHEN p_update ? 'wind_exposure_factors' THEN ARRAY(SELECT jsonb_array_elements_text(p_update->'wind_exposure_factors'))::real[] ELSE wind_exposure_factors END,
    terrain_method = p_update->>'terrain_method',
    terrain_params = p_update->'terrain_params',
    terrain_params_hash = p_update->>'terrain_params_hash',
    terrain_analyzed_at = (p_update->>'terrain_analyzed_at')::timestamptz,
    terrain_status = p_update->>'terrain_status',
    terrain_analysis_debug = p_update->'terrain_analysis_debug',
    fingerprint_model_version = p_update->>'fingerprint_model_version',
    fingerprint_coordinate_hash = p_update->>'fingerprint_coordinate_hash',
    fingerprint_provenance_state = p_update->>'fingerprint_provenance_state',
    fingerprint_provenance = p_update->'fingerprint_provenance',
    fingerprint_confidence = p_update->>'fingerprint_confidence',
    fingerprint_updated_at = (p_update->>'fingerprint_updated_at')::timestamptz
  WHERE id = target_spot_id
    AND updated_at = p_spot_updated_at
    AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.custom_spot_analysis_jobs
  SET status = 'complete', locked_at = NULL, last_error_code = NULL, updated_at = now()
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_at = p_claimed_at;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_custom_spot_analysis_job(bigint, timestamptz, timestamptz, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_custom_spot_analysis_job(bigint, timestamptz, timestamptz, jsonb)
  TO service_role;

CREATE OR REPLACE FUNCTION public.fail_custom_spot_analysis_job(
  p_job_id bigint,
  p_claimed_at timestamptz,
  p_spot_updated_at timestamptz,
  p_provenance_state text,
  p_error_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_spot_id uuid;
BEGIN
  SELECT custom_spot_id INTO target_spot_id
  FROM public.custom_spot_analysis_jobs
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_at = p_claimed_at
  FOR UPDATE;

  IF target_spot_id IS NULL THEN RETURN false; END IF;

  UPDATE public.custom_spots
  SET terrain_status = 'failed', fingerprint_provenance_state = p_provenance_state
  WHERE id = target_spot_id
    AND updated_at = p_spot_updated_at
    AND deleted_at IS NULL;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE public.custom_spot_analysis_jobs
  SET status = 'failed', locked_at = NULL, last_error_code = p_error_code, updated_at = now()
  WHERE id = p_job_id
    AND status = 'processing'
    AND locked_at = p_claimed_at;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_custom_spot_analysis_job(bigint, timestamptz, timestamptz, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_custom_spot_analysis_job(bigint, timestamptz, timestamptz, text, text)
  TO service_role;

-- Existing rows are intentionally not enqueued by the migration. The bounded
-- backfill command owns that resumable operation and defaults to dry-run.

COMMIT;
