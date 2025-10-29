-- Improve the create_session_forecast_snapshot function to handle INSERT events better
--
-- The original function checks: OLD.status IS NULL OR OLD.status <> 'completed'
-- While this technically works for INSERT (where OLD.status IS NULL), it's clearer
-- to explicitly handle INSERT vs UPDATE cases.
--
-- Also add better error handling and logging.

CREATE OR REPLACE FUNCTION create_session_forecast_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  forecast_data JSONB;
  conditions_data JSONB;
  snapshot_exists BOOLEAN;
BEGIN
  -- Only proceed if the session is completed
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  -- For UPDATE events, only proceed if status changed TO completed
  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Check if snapshot already exists (prevents duplicates)
  SELECT EXISTS(
    SELECT 1 FROM session_forecast_snapshots
    WHERE session_id = NEW.id
  ) INTO snapshot_exists;

  IF snapshot_exists THEN
    -- Snapshot already exists, skip creation
    RETURN NEW;
  END IF;

  -- Find the closest forecast to the session arrival_time
  SELECT to_jsonb(ef.*) INTO forecast_data
  FROM enhanced_forecasts ef
  WHERE ef.beach_id::uuid = NEW.beach_id::uuid
    AND ef.forecast_date = NEW.arrival_time::date
  ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_time::time - NEW.arrival_time::time))) ASC
  LIMIT 1;

  -- Build actual conditions from session data
  conditions_data := jsonb_build_object(
    'wave_quality', NEW.wave_quality,
    'water_temp', NEW.water_temp,
    'crowd_level', NEW.crowd_level,
    'parking_ease', NEW.parking_ease,
    'rating', NEW.rating,
    'notes', NEW.notes,
    'duration_minutes', NEW.duration_minutes,
    'arrival_time', NEW.arrival_time
  );

  -- Only insert if we found forecast data
  IF forecast_data IS NOT NULL THEN
    BEGIN
      INSERT INTO session_forecast_snapshots (
        session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
        forecast_confidence_score, data_source, session_date
      ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.beach_id::uuid,
        forecast_data,
        conditions_data,
        (forecast_data->>'confidence_score')::integer,
        forecast_data->>'data_source',
        NEW.arrival_time::date
      );
    EXCEPTION
      WHEN unique_violation THEN
        -- Snapshot already exists (race condition), ignore
        NULL;
      WHEN OTHERS THEN
        -- Log error but don't fail the session creation/update
        RAISE WARNING 'Failed to create forecast snapshot for session %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
