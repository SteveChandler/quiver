-- Versioned north_360_to_0.v1 normalization provenance. Only raw direction exactly 360 with a positive period becomes 0.
-- Preserve raw/semantic bytes, hashes, zero-tuple missingness, canonical constraints,
-- all existing grants, cohort, policy, authority, freshness and send controls.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
DO $normalization$
DECLARE definition text; old_fragment text; new_fragment text; patch record;
BEGIN
  IF current_user <> 'postgres' THEN RAISE EXCEPTION 'production owner required'; END IF;
  SELECT pg_get_functiondef('public.record_swell_watch_provider_run_receipt(jsonb)'::regprocedure) INTO definition;
  IF encode(extensions.digest(definition,'sha256'),'hex')='0374cd88bf8a6edf727a82dea6d90e6b9d4962dbe9d812c0581651a69d4c8dd4' THEN RETURN; END IF;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'26d064b92fb0023f079d399ca062833f7d9a882d53d1f1e9ab55ef1a5726f522' THEN
    RAISE EXCEPTION 'receipt function differs from reviewed baseline';
  END IF;
  FOR patch IN SELECT * FROM (VALUES
    ($old$(v_component->>'directionDeg')::numeric IS DISTINCT FROM (v_raw->'hourly'->'swell_wave_direction'->>v_index)::numeric$old$,$new$(v_component->>'directionDeg')::numeric IS DISTINCT FROM (CASE WHEN (v_raw->'hourly'->'swell_wave_direction'->>v_index)::numeric=360 AND (v_component->>'periodS')::numeric>0 THEN 0 ELSE (v_raw->'hourly'->'swell_wave_direction'->>v_index)::numeric END)$new$),
    ($old$v_component->'rawFieldProvenance' IS DISTINCT FROM '{"height":"swell_wave_height","period":"swell_wave_period","direction":"swell_wave_direction"}'::jsonb$old$,$new$v_component->'rawFieldProvenance' IS DISTINCT FROM ('{"height":"swell_wave_height","period":"swell_wave_period","direction":"swell_wave_direction"}'::jsonb || CASE WHEN (v_raw->'hourly'->'swell_wave_direction'->>v_index)::numeric=360 THEN '{"directionNormalization":{"rule":"north_360_to_0.v1","rawDegrees":360,"canonicalDegrees":0}}'::jsonb ELSE '{}'::jsonb END)$new$),
    ($old$(v_component->>'directionDeg')::numeric IS DISTINCT FROM (v_raw->'hourly'->'secondary_swell_wave_direction'->>v_index)::numeric$old$,$new$(v_component->>'directionDeg')::numeric IS DISTINCT FROM (CASE WHEN (v_raw->'hourly'->'secondary_swell_wave_direction'->>v_index)::numeric=360 AND (v_component->>'periodS')::numeric>0 THEN 0 ELSE (v_raw->'hourly'->'secondary_swell_wave_direction'->>v_index)::numeric END)$new$),
    ($old$v_component->'rawFieldProvenance' IS DISTINCT FROM '{"height":"secondary_swell_wave_height","period":"secondary_swell_wave_period","direction":"secondary_swell_wave_direction"}'::jsonb$old$,$new$v_component->'rawFieldProvenance' IS DISTINCT FROM ('{"height":"secondary_swell_wave_height","period":"secondary_swell_wave_period","direction":"secondary_swell_wave_direction"}'::jsonb || CASE WHEN (v_raw->'hourly'->'secondary_swell_wave_direction'->>v_index)::numeric=360 THEN '{"directionNormalization":{"rule":"north_360_to_0.v1","rawDegrees":360,"canonicalDegrees":0}}'::jsonb ELSE '{}'::jsonb END)$new$)
  ) AS patches(before_text,after_text) LOOP
    old_fragment := patch.before_text; new_fragment := patch.after_text;
    IF (length(definition)-length(replace(definition,old_fragment,'')))/length(old_fragment)<>1 THEN
      RAISE EXCEPTION 'receipt normalization patch is not unique';
    END IF;
    definition := replace(definition,old_fragment,new_fragment);
  END LOOP;
  IF encode(extensions.digest(definition,'sha256'),'hex')<>'0374cd88bf8a6edf727a82dea6d90e6b9d4962dbe9d812c0581651a69d4c8dd4' THEN
    RAISE EXCEPTION 'receipt normalization definition hash mismatch';
  END IF;
  EXECUTE definition;
END;
$normalization$;
COMMIT;
