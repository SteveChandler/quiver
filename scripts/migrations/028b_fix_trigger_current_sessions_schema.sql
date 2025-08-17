-- Fix trigger function to match current sessions schema (no wave_height, crowd_rating columns)
CREATE OR REPLACE FUNCTION create_session_forecast_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  forecast_data JSONB;
  conditions_data JSONB;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    SELECT to_jsonb(ef.*) INTO forecast_data
    FROM enhanced_forecasts ef
    WHERE ef.beach_id::uuid = NEW.beach_id::uuid
      AND ef.forecast_date = NEW.arrival_time::date
    ORDER BY ABS(EXTRACT(EPOCH FROM (ef.forecast_time::time - NEW.arrival_time::time))) ASC
    LIMIT 1;

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

    IF forecast_data IS NOT NULL THEN
      INSERT INTO session_forecast_snapshots (
        session_id,
        user_id,
        beach_id,
        forecast_snapshot,
        actual_conditions,
        forecast_confidence_score,
        data_source,
        session_date
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
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

