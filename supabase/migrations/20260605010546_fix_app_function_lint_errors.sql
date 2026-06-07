-- Fix application-owned PL/pgSQL definitions that fail Supabase db lint.
--
-- Extension-owned PostGIS functions still lint noisy when PostGIS is installed
-- in public, but these replacements remove the Quiver function errors from the
-- app schema surface.

BEGIN;

SET LOCAL search_path TO public, extensions, pg_temp;

CREATE OR REPLACE FUNCTION public.update_beach_coordinates(
  p_beach_id UUID,
  p_longitude DOUBLE PRECISION,
  p_latitude DOUBLE PRECISION
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  UPDATE public.beaches
  SET
    lat = p_latitude,
    lon = p_longitude
  WHERE public.beaches.id = p_beach_id;
END;
$$;

COMMENT ON FUNCTION public.update_beach_coordinates(UUID, DOUBLE PRECISION, DOUBLE PRECISION) IS
  'Updates canonical beach latitude/longitude. The geog generated column derives from lon/lat.';

CREATE OR REPLACE FUNCTION public.cleanup_session_media_storage(media_id UUID)
RETURNS TABLE(success BOOLEAN, message TEXT, storage_path TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  media_record RECORD;
  v_is_admin BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.is_admin = true
  )
  INTO v_is_admin;

  SELECT sm.*, (sm.user_id = auth.uid() OR v_is_admin) AS can_delete
  INTO media_record
  FROM public.session_media sm
  WHERE sm.id = cleanup_session_media_storage.media_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Media not found'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  IF NOT media_record.can_delete THEN
    RETURN QUERY SELECT false, 'Unauthorized to delete this media'::TEXT, NULL::TEXT;
    RETURN;
  END IF;

  UPDATE public.session_media sm
  SET deleted_at = NOW()
  WHERE sm.id = media_record.id
    AND sm.deleted_at IS NULL;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Media already deleted'::TEXT, media_record.storage_path;
    RETURN;
  END IF;

  RETURN QUERY SELECT
    true,
    ('Media record soft-deleted. Storage cleanup required: ' || media_record.storage_path)::TEXT,
    media_record.storage_path;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_database_maintenance(
  cleanup_forecasts BOOLEAN DEFAULT true,
  cleanup_buoys BOOLEAN DEFAULT true,
  update_stats BOOLEAN DEFAULT true,
  forecast_retention_days INTEGER DEFAULT 30,
  buoy_inactive_days INTEGER DEFAULT 7
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  result JSONB;
  forecasts_cleaned INTEGER := 0;
  buoys_cleaned INTEGER := 0;
  start_time TIMESTAMP WITH TIME ZONE := NOW();
BEGIN
  result := jsonb_build_object(
    'maintenance_started', start_time,
    'operations', '[]'::jsonb
  );

  IF cleanup_forecasts THEN
    forecasts_cleaned := public.cleanup_old_forecasts(forecast_retention_days);
    result := jsonb_set(
      result,
      '{operations}',
      result->'operations' || jsonb_build_object(
        'operation', 'forecast_cleanup',
        'records_affected', forecasts_cleaned,
        'retention_days', forecast_retention_days
      )
    );
  END IF;

  IF cleanup_buoys THEN
    buoys_cleaned := public.cleanup_inactive_buoys(buoy_inactive_days);
    result := jsonb_set(
      result,
      '{operations}',
      result->'operations' || jsonb_build_object(
        'operation', 'buoy_cleanup',
        'records_affected', buoys_cleaned,
        'inactive_days', buoy_inactive_days
      )
    );
  END IF;

  IF update_stats THEN
    PERFORM public.update_forecast_table_stats();
    result := jsonb_set(
      result,
      '{operations}',
      result->'operations' || jsonb_build_object(
        'operation', 'statistics_update',
        'completed', true
      )
    );
  END IF;

  result := jsonb_set(result, '{maintenance_completed}', to_jsonb(NOW()));
  result := jsonb_set(
    result,
    '{duration_seconds}',
    to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time)))
  );

  RETURN result::JSON;
END;
$$;

CREATE OR REPLACE FUNCTION public.refresh_enhanced_forecasts_for_active_beaches()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  result JSONB;
  beaches_count INTEGER := 0;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
  start_time TIMESTAMP WITH TIME ZONE := NOW();
  beach_rec RECORD;
BEGIN
  result := jsonb_build_object(
    'operation', 'enhanced_forecasts_refresh',
    'started_at', start_time,
    'beaches_processed', 0,
    'successful_updates', 0,
    'failed_updates', 0,
    'errors', '[]'::jsonb
  );

  FOR beach_rec IN
    SELECT DISTINCT b.id, b.name, b.lat, b.lon
    FROM public.beaches b
    WHERE b.lat IS NOT NULL
      AND b.lon IS NOT NULL
      AND (
        EXISTS (
          SELECT 1
          FROM public.sessions s
          WHERE s.beach_id = b.id
            AND s.created_at > NOW() - INTERVAL '30 days'
        )
        OR b.is_private = false
      )
    ORDER BY b.name
    LIMIT 50
  LOOP
    beaches_count := beaches_count + 1;

    BEGIN
      RAISE NOTICE 'Processing forecast refresh for beach: % (%, %)',
        beach_rec.name, beach_rec.lat, beach_rec.lon;

      success_count := success_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        error_count := error_count + 1;
        result := jsonb_set(
          result,
          '{errors}',
          result->'errors' || jsonb_build_object(
            'beach_id', beach_rec.id,
            'beach_name', beach_rec.name,
            'error', SQLERRM,
            'timestamp', NOW()
          )
        );

        RAISE NOTICE 'Error processing beach %: %', beach_rec.name, SQLERRM;
    END;
  END LOOP;

  result := jsonb_set(result, '{beaches_processed}', to_jsonb(beaches_count));
  result := jsonb_set(result, '{successful_updates}', to_jsonb(success_count));
  result := jsonb_set(result, '{failed_updates}', to_jsonb(error_count));
  result := jsonb_set(result, '{completed_at}', to_jsonb(NOW()));
  result := jsonb_set(
    result,
    '{duration_seconds}',
    to_jsonb(EXTRACT(EPOCH FROM (NOW() - start_time)))
  );

  RAISE NOTICE 'Enhanced forecasts refresh completed: % beaches processed, % successful, % failed',
    beaches_count, success_count, error_count;

  RETURN result::JSON;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_anon_alert_capture(
  p_user_id UUID,
  p_email TEXT
)
RETURNS TABLE(
  capture_id UUID,
  beach_id UUID,
  preset_type TEXT,
  return_path TEXT,
  captured_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH claimed_captures AS (
    UPDATE public.pending_alert_captures AS pac
    SET
      consumed_at = NOW(),
      consumed_user_id = p_user_id
    WHERE pac.email = lower(p_email)
      AND pac.consumed_at IS NULL
      AND pac.expires_at > NOW()
    RETURNING
      pac.id AS capture_id,
      pac.beach_id,
      pac.preset_type,
      pac.return_path,
      pac.captured_at
  ),
  inserted_rules AS (
    INSERT INTO public.alert_rules (
      user_id,
      beach_id,
      name,
      preset_type,
      conditions,
      notify_email,
      notify_push,
      enabled
    )
    SELECT
      p_user_id,
      cc.beach_id,
      public.preset_default_name(cc.preset_type, cc.beach_id),
      cc.preset_type,
      public.preset_default_conditions(cc.preset_type, cc.beach_id),
      true,
      false,
      true
    FROM claimed_captures cc
    RETURNING public.alert_rules.id
  ),
  first_claim AS (
    SELECT cc.beach_id
    FROM claimed_captures cc
    ORDER BY cc.captured_at ASC
    LIMIT 1
  ),
  updated_profile AS (
    UPDATE public.profiles p
    SET
      home_beach_id = COALESCE(p.home_beach_id, fc.beach_id),
      signup_context = jsonb_set(
        COALESCE(p.signup_context, '{}'::jsonb),
        '{entrypoint}',
        '"anon_alert_capture"'::jsonb
      )
    FROM first_claim fc
    WHERE p.id = p_user_id
    RETURNING p.id
  )
  SELECT
    cc.capture_id,
    cc.beach_id,
    cc.preset_type,
    cc.return_path,
    cc.captured_at
  FROM claimed_captures cc
  ORDER BY cc.captured_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_anon_alert_capture(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_anon_alert_capture(UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.repair_strict_session_snapshots(
  p_limit INTEGER DEFAULT 100,
  p_apply BOOLEAN DEFAULT false
)
RETURNS TABLE(
  session_id UUID,
  user_id UUID,
  beach_id UUID,
  forecast_at TIMESTAMP WITH TIME ZONE,
  delta_minutes NUMERIC,
  repaired BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT p_apply THEN
    RETURN QUERY
    SELECT
      c.session_id,
      c.user_id,
      c.beach_id,
      c.forecast_at,
      c.delta_minutes,
      false AS repaired
    FROM public.strict_session_snapshot_repair_candidates(p_limit) c;
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT * FROM public.strict_session_snapshot_repair_candidates(p_limit)
  ),
  source_rows AS (
    SELECT
      c.session_id,
      c.user_id,
      c.beach_id,
      c.forecast_at,
      c.delta_minutes,
      s.arrival_time,
      s.rating,
      s.wave_quality,
      s.wave_height_ft,
      s.crowd_level,
      s.duration_minutes,
      to_jsonb(ef) AS forecast_snapshot,
      ef.confidence_score,
      ef.data_source
    FROM candidates c
    JOIN public.sessions s ON s.id = c.session_id
    JOIN public.enhanced_forecasts ef
      ON ef.beach_id = c.beach_id
      AND ef.forecast_at = c.forecast_at
  ),
  inserted AS (
    INSERT INTO public.session_forecast_snapshots (
      session_id,
      user_id,
      beach_id,
      forecast_snapshot,
      actual_conditions,
      forecast_confidence_score,
      data_source,
      session_date
    )
    SELECT
      sr.session_id,
      sr.user_id,
      sr.beach_id,
      sr.forecast_snapshot,
      jsonb_build_object(
        'arrival_time', sr.arrival_time,
        'rating', sr.rating,
        'wave_quality', sr.wave_quality,
        'wave_height_ft', sr.wave_height_ft,
        'crowd_level', sr.crowd_level,
        'duration_minutes', sr.duration_minutes
      ),
      sr.confidence_score,
      sr.data_source,
      sr.arrival_time::date
    FROM source_rows sr
    ON CONFLICT ON CONSTRAINT unique_session_forecast_snapshot DO NOTHING
    RETURNING public.session_forecast_snapshots.session_id AS inserted_session_id
  )
  SELECT
    sr.session_id,
    sr.user_id,
    sr.beach_id,
    sr.forecast_at,
    sr.delta_minutes,
    inserted.inserted_session_id IS NOT NULL AS repaired
  FROM source_rows sr
  LEFT JOIN inserted ON inserted.inserted_session_id = sr.session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_beach_observation_station(p_beach_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_station_id TEXT;
BEGIN
  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND EXISTS (
      SELECT 1
      FROM public.ioos_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '24 hours'
    )
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  SELECT s.station_id INTO v_station_id
  FROM public.ioos_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND ST_DWithin(b.geog, s.coordinates::geography, 50000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
    AND EXISTS (
      SELECT 1
      FROM public.ioos_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '48 hours'
    )
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  WHERE s.active = true
    AND s.has_wave_data = true
    AND s.nearest_beach_id = p_beach_id
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND EXISTS (
      SELECT 1
      FROM public.ndbc_direct_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '24 hours'
    )
  ORDER BY s.distance_to_beach_km
  LIMIT 1;

  IF v_station_id IS NOT NULL THEN
    RETURN v_station_id;
  END IF;

  SELECT s.station_id INTO v_station_id
  FROM public.ndbc_direct_stations s
  JOIN public.beaches b ON b.id = p_beach_id
  JOIN public.beaches nb ON nb.id = s.nearest_beach_id
  WHERE s.active = true
    AND s.has_wave_data = true
    AND (
      s.ioos_station_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM public.ioos_stations iss
        WHERE iss.station_id = s.ioos_station_id
          AND iss.active = true
      )
    )
    AND ST_DWithin(b.geog, s.coordinates::geography, 50000)
    AND public.swell_windows_overlap(
          b.swell_window_min_deg, b.swell_window_max_deg,
          nb.swell_window_min_deg, nb.swell_window_max_deg
        ) >= 30
    AND EXISTS (
      SELECT 1
      FROM public.ndbc_direct_observations o
      WHERE o.station_id = s.station_id
        AND o.wave_height_m IS NOT NULL
        AND o.observed_at > NOW() - INTERVAL '48 hours'
    )
  ORDER BY ST_Distance(b.geog, s.coordinates::geography)
  LIMIT 1;

  RETURN v_station_id;
END;
$$;

COMMENT ON FUNCTION public.get_beach_observation_station(UUID) IS
  'Returns the active wave station used for ML observation matching. Direct mappings are preferred, then IOOS/NDBC-direct spatial fallback within 50km and >= 30 degrees swell overlap. Each tier requires recent positive source observations so stale/no-wave stations are not selected.';

GRANT EXECUTE ON FUNCTION public.get_beach_observation_station(UUID)
TO authenticated, anon, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
