-- Update create_session_forecast_snapshot trigger function to include all condition fields
-- and calculate forecast_vs_actual diff
--
-- This migration updates the trigger function to:
-- 1. Include all session condition fields (wave_height_ft, wind_speed_mph, wind_direction, forecast_accuracy, tide_height_ft, tide_status)
-- 2. Calculate forecast_vs_actual diff for numeric and string fields
-- 3. Store the diff in the new forecast_vs_actual column

CREATE OR REPLACE FUNCTION create_session_forecast_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  forecast_data JSONB;
  conditions_data JSONB;
  forecast_vs_actual_data JSONB;
  snapshot_exists BOOLEAN;
  forecast_wave_height NUMERIC;
  forecast_wind_speed NUMERIC;
  forecast_tide_height NUMERIC;
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

  -- Build actual conditions from session data (all fields)
  conditions_data := jsonb_build_object(
    'wave_quality', NEW.wave_quality,
    'water_temp', NEW.water_temp,
    'crowd_level', NEW.crowd_level,
    'parking_ease', NEW.parking_ease,
    'rating', NEW.rating,
    'notes', NEW.notes,
    'duration_minutes', NEW.duration_minutes,
    'arrival_time', NEW.arrival_time,
    'wave_height_ft', NEW.wave_height_ft,
    'wind_speed_mph', NEW.wind_speed_mph,
    'wind_direction', NEW.wind_direction,
    'forecast_accuracy', NEW.forecast_accuracy,
    'tide_height_ft', NEW.tide_height_ft,
    'tide_status', NEW.tide_status
  );

  -- Calculate forecast_vs_actual diff if forecast data exists
  IF forecast_data IS NOT NULL THEN
    forecast_vs_actual_data := '{}'::jsonb;

    -- Wave height diff (forecast is string, session is numeric)
    IF forecast_data->>'wave_height' IS NOT NULL AND NEW.wave_height_ft IS NOT NULL THEN
      BEGIN
        forecast_wave_height := (forecast_data->>'wave_height')::numeric;
        IF forecast_wave_height IS DISTINCT FROM NEW.wave_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wave_height_ft', jsonb_build_object(
              'forecast', forecast_wave_height,
              'actual', NEW.wave_height_ft,
              'diff', NEW.wave_height_ft - forecast_wave_height
            )
          );
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL; -- Skip if conversion fails
      END;
    END IF;

    -- Wind speed diff
    IF forecast_data->>'wind_speed_mph' IS NOT NULL AND NEW.wind_speed_mph IS NOT NULL THEN
      BEGIN
        forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
        IF forecast_wind_speed IS DISTINCT FROM NEW.wind_speed_mph THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wind_speed_mph', jsonb_build_object(
              'forecast', forecast_wind_speed,
              'actual', NEW.wind_speed_mph,
              'diff', NEW.wind_speed_mph - forecast_wind_speed
            )
          );
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL; -- Skip if conversion fails
      END;
    END IF;

    -- Wind direction diff (string comparison)
    IF forecast_data->>'wind_direction' IS NOT NULL AND NEW.wind_direction IS NOT NULL THEN
      IF forecast_data->>'wind_direction' <> NEW.wind_direction THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'wind_direction', jsonb_build_object(
            'forecast', forecast_data->>'wind_direction',
            'actual', NEW.wind_direction
          )
        );
      END IF;
    END IF;

    -- Tide height diff (forecast is string, session is numeric)
    IF forecast_data->>'tide_height' IS NOT NULL AND NEW.tide_height_ft IS NOT NULL THEN
      BEGIN
        forecast_tide_height := (forecast_data->>'tide_height')::numeric;
        IF forecast_tide_height IS DISTINCT FROM NEW.tide_height_ft THEN
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'tide_height_ft', jsonb_build_object(
              'forecast', forecast_tide_height,
              'actual', NEW.tide_height_ft,
              'diff', NEW.tide_height_ft - forecast_tide_height
            )
          );
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          NULL; -- Skip if conversion fails
      END;
    END IF;

    -- Tide status diff (string comparison)
    IF forecast_data->>'tide_status' IS NOT NULL AND NEW.tide_status IS NOT NULL THEN
      IF forecast_data->>'tide_status' <> NEW.tide_status THEN
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'tide_status', jsonb_build_object(
            'forecast', forecast_data->>'tide_status',
            'actual', NEW.tide_status
          )
        );
      END IF;
    END IF;

    -- Insert snapshot with all fields
    BEGIN
      INSERT INTO session_forecast_snapshots (
        session_id, user_id, beach_id, forecast_snapshot, actual_conditions,
        forecast_vs_actual, forecast_confidence_score, data_source, session_date
      ) VALUES (
        NEW.id,
        NEW.user_id,
        NEW.beach_id::uuid,
        forecast_data,
        conditions_data,
        forecast_vs_actual_data,
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

-- The trigger already exists from the original migration, no need to recreate it
-- (DROP TRIGGER IF EXISTS trigger_create_session_forecast_snapshot ON sessions;
--  CREATE TRIGGER trigger_create_session_forecast_snapshot...)
